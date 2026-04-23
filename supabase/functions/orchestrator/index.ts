import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getKnowledge,
  logAgentRun,
  sendFailureAlert,
  setKnowledge,
} from "../_shared/base.ts";

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve: (
    handler: (req: Request) => Response | Promise<Response>,
  ) => void;
};

/** 24 autonomous SEO pipeline agents (excluding orchestrator). */
const PIPELINE_AGENTS: readonly string[] = [
  "keyword-research",
  "competitor-analysis",
  "technical-seo",
  "content-strategy",
  "on-page-optimizer",
  "local-seo",
  "schema-markup",
  "link-building",
  "analytics-sync",
  "rank-tracker",
  "indexing",
  "crawl-budget",
  "duplicate-content",
  "translation-es",
  "geo-intelligence",
  "lead-scoring",
  "content-writer",
  "qc-editor",
  "sitemap-agent",
  "robots-txt",
  "meta-optimizer",
  "internal-linking",
  "performance-core-web",
  "reporting",
] as const;

/** Expected max hours between successful runs (missed = 2× overdue). */
const EXPECTED_RUN_HOURS: Record<string, number> = {
  "rank-tracker": 12,
  "analytics-sync": 12,
  "reporting": 12,
};

function expectedHoursFor(agent: string): number {
  return EXPECTED_RUN_HOURS[agent] ?? 24;
}

function getEasternCalendarDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function getEasternHour(d: Date): number {
  const h = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    hour12: false,
  }).format(d);
  return parseInt(h, 10);
}

/** First instant (UTC) when the America/New_York calendar date is `ymd` at 00:00. */
function getEasternDayStartUtc(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const probeStart = Date.UTC(y, m - 1, d - 1, 0, 0, 0);
  const probeEnd = Date.UTC(y, m - 1, d + 2, 0, 0, 0);
  for (let t = probeStart; t < probeEnd; t += 15 * 60 * 1000) {
    const dt = new Date(t);
    if (getEasternCalendarDate(dt) !== ymd) continue;
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).formatToParts(dt);
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    if (hour === 0 && minute === 0) return dt;
  }
  return new Date(Date.UTC(y, m - 1, d, 7, 0, 0));
}

function estimateSpendFromLogs(
  logs: { metadata?: unknown }[],
): { usd: number; sonnetRuns: number; haikuRuns: number } {
  let sonnetRuns = 0;
  let haikuRuns = 0;
  for (const log of logs) {
    const m = log.metadata as Record<string, unknown> | undefined;
    const model = String(m?.model ?? m?.anthropic_model ?? "").toLowerCase();
    if (model.includes("haiku")) haikuRuns += 1;
    else if (model.includes("sonnet") || model.includes("claude-3-5")) {
      sonnetRuns += 1;
    }
  }
  const usd = sonnetRuns * 0.003 + haikuRuns * 0.00025;
  return { usd, sonnetRuns, haikuRuns };
}

async function fetchLatestLog(
  supabase: SupabaseClient,
  agentName: string,
): Promise<{
  run_at: string;
  status: string;
} | null> {
  const { data, error } = await supabase
    .from("agent_logs")
    .select("run_at, status")
    .eq("agent_name", agentName)
    .order("run_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return { run_at: data.run_at as string, status: data.status as string };
}

type AgentHealth = {
  agent: string;
  last_run_at: string | null;
  last_status: string | null;
  expected_hours: number;
  state: "ok" | "overdue" | "failing" | "never_run";
};

async function buildHealthSummary(
  supabase: SupabaseClient,
  now: Date,
): Promise<{ agents: AgentHealth[]; overdue: number; failing: number }> {
  const agents: AgentHealth[] = [];
  let overdue = 0;
  let failing = 0;

  for (const agent of PIPELINE_AGENTS) {
    const latest = await fetchLatestLog(supabase, agent);
    const expected = expectedHoursFor(agent);
    if (!latest) {
      agents.push({
        agent,
        last_run_at: null,
        last_status: null,
        expected_hours: expected,
        state: "never_run",
      });
      overdue += 1;
      continue;
    }

    const lastRun = new Date(latest.run_at);
    const hoursSince = (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60);
    const missed2x = hoursSince > expected * 2;

    let state: AgentHealth["state"] = "ok";
    if (latest.status === "error") {
      state = "failing";
      failing += 1;
    } else if (missed2x) {
      state = "overdue";
      overdue += 1;
    }

    agents.push({
      agent,
      last_run_at: latest.run_at,
      last_status: latest.status,
      expected_hours: expected,
      state,
    });
  }

  return { agents, overdue, failing };
}

async function checkDlqAndMaybeAlert(
  supabase: SupabaseClient,
  adminEmail: string,
  now: Date,
): Promise<{ dlqCount: number; alertSent: boolean }> {
  const { data: rows, error } = await supabase
    .from("dead_letter_queue")
    .select("id")
    .eq("acknowledged", false);

  if (error) throw error;
  const dlqCount = rows?.length ?? 0;
  if (dlqCount === 0) return { dlqCount, alertSent: false };
  if (!adminEmail.trim() || !Deno.env.get("RESEND_API_KEY")) {
    return { dlqCount, alertSent: false };
  }

  const lastRaw = await getKnowledge(
    supabase,
    "orchestrator",
    "ops",
    "last_dlq_alert_at",
  );
  const lastMs = lastRaw && typeof lastRaw === "object" && lastRaw !== null &&
      "ms" in lastRaw
    ? Number((lastRaw as { ms?: unknown }).ms)
    : NaN;

  if (Number.isFinite(lastMs) && now.getTime() - lastMs < 60 * 60 * 1000) {
    return { dlqCount, alertSent: false };
  }

  await sendFailureAlert(
    adminEmail,
    "dead_letter_queue",
    `${dlqCount} unacknowledged DLQ job(s) require attention.`,
  );
  await setKnowledge(supabase, "orchestrator", "ops", "last_dlq_alert_at", {
    ms: now.getTime(),
    iso: now.toISOString(),
  });
  return { dlqCount, alertSent: true };
}

async function enforceBudget(
  supabase: SupabaseClient,
  dayStartIso: string,
  dayEndIso: string,
  dailyBudgetUsd: number,
): Promise<{
  spendUsd: number;
  sonnetRuns: number;
  haikuRuns: number;
  exceeded: boolean;
}> {
  const { data: logs, error } = await supabase
    .from("agent_logs")
    .select("metadata")
    .gte("run_at", dayStartIso)
    .lt("run_at", dayEndIso);

  if (error) throw error;
  const { usd, sonnetRuns, haikuRuns } = estimateSpendFromLogs(logs ?? []);
  const exceeded = usd > dailyBudgetUsd;

  if (exceeded) {
    await setKnowledge(supabase, "orchestrator", "budget", "budget_exceeded", {
      spend_usd: usd,
      daily_budget_usd: dailyBudgetUsd,
      day: dayStartIso.slice(0, 10),
    });
  }

  return { spendUsd: usd, sonnetRuns, haikuRuns, exceeded };
}

async function analyzePriorityQueue(
  supabase: SupabaseClient,
  now: Date,
): Promise<{
  pending_hot_sla_risk: number;
  pending_warm_sla_risk: number;
  pending_basic: number;
}> {
  const { data: pending, error } = await supabase
    .from("agent_queue")
    .select("priority, created_at")
    .eq("status", "pending");

  if (error) throw error;
  let hotRisk = 0;
  let warmRisk = 0;
  let basic = 0;

  for (const row of pending ?? []) {
    const p = row.priority as number;
    const created = new Date(row.created_at as string);
    const ageHours = (now.getTime() - created.getTime()) / (1000 * 60 * 60);

    if (p >= 8) {
      if (ageHours > 2) hotRisk += 1;
    } else if (p >= 5 && p <= 7) {
      if (ageHours > 24) warmRisk += 1;
    } else {
      basic += 1;
    }
  }

  return {
    pending_hot_sla_risk: hotRisk,
    pending_warm_sla_risk: warmRisk,
    pending_basic: basic,
  };
}

async function maybeSendDailyBriefing(
  supabase: SupabaseClient,
  adminEmail: string,
  now: Date,
  dayStartIso: string,
  dayEndIso: string,
  todayEt: string,
  health: Awaited<ReturnType<typeof buildHealthSummary>>,
  spend: Awaited<ReturnType<typeof enforceBudget>>,
  dlqCount: number,
  priority: Awaited<ReturnType<typeof analyzePriorityQueue>>,
): Promise<boolean> {
  const hourEt = getEasternHour(now);
  if (hourEt !== 8) return false;

  const lastRaw = await getKnowledge(
    supabase,
    "orchestrator",
    "briefing",
    "last_briefing_sent",
  );
  const lastDate =
    lastRaw && typeof lastRaw === "object" && lastRaw !== null &&
        "date" in lastRaw
      ? String((lastRaw as { date?: unknown }).date)
      : null;

  if (lastDate === todayEt) return false;

  const { count: pagesPublished, error: pErr } = await supabase
    .from("seo_pages")
    .select("*", { count: "exact", head: true })
    .eq("status", "published")
    .gte("published_at", dayStartIso)
    .lt("published_at", dayEndIso);

  if (pErr) throw pErr;

  const { data: todayLogs, error: lErr } = await supabase
    .from("agent_logs")
    .select("records_processed")
    .gte("run_at", dayStartIso)
    .lt("run_at", dayEndIso);

  if (lErr) throw lErr;
  const recordsProcessed = (todayLogs ?? []).reduce(
    (acc, row) => acc + Number(row.records_processed ?? 0),
    0,
  );

  const activeAlerts =
    health.overdue + health.failing + (dlqCount > 0 ? 1 : 0);

  const body = [
    `Daily briefing (${todayEt} ET)`,
    "",
    `Agent health: ${health.agents.filter((a) => a.state === "ok").length}/24 ok, overdue=${health.overdue}, failing=${health.failing}`,
    `Pages published today: ${pagesPublished ?? 0}`,
    `Records processed today: ${recordsProcessed}`,
    `Active alerts (approx): ${activeAlerts}`,
    `Estimated spend today: $${spend.spendUsd.toFixed(4)} (Sonnet ${spend.sonnetRuns}, Haiku ${spend.haikuRuns})`,
    `Queue SLA risk — hot: ${priority.pending_hot_sla_risk}, warm: ${priority.pending_warm_sla_risk}, basic pending: ${priority.pending_basic}`,
  ].join("\n");

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (apiKey) {
    const from = Deno.env.get("RESEND_FROM_EMAIL") ?? "onboarding@resend.dev";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [adminEmail],
        subject: `[FLBusinessSearch] Daily orchestrator briefing — ${todayEt}`,
        text: body,
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Briefing Resend error ${res.status}: ${t}`);
    }
  }

  await setKnowledge(supabase, "orchestrator", "briefing", "last_briefing_sent", {
    date: todayEt,
    sent_at: now.toISOString(),
  });
  return true;
}

async function runOrchestrator(): Promise<void> {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    console.error("orchestrator: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return;
  }

  const adminEmail = Deno.env.get("ADMIN_EMAIL") ?? "";
  const budgetRaw = Deno.env.get("DAILY_BUDGET_USD");
  const dailyBudgetUsd = budgetRaw ? Number.parseFloat(budgetRaw) : 2;

  const supabase = createClient(url, key);
  const now = new Date();

  const todayEt = getEasternCalendarDate(now);
  const dayStart = getEasternDayStartUtc(todayEt);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const dayStartIso = dayStart.toISOString();
  const dayEndIso = dayEnd.toISOString();

  const health = await buildHealthSummary(supabase, now);
  const { dlqCount } = await checkDlqAndMaybeAlert(
    supabase,
    adminEmail,
    now,
  );

  const spend = await enforceBudget(
    supabase,
    dayStartIso,
    dayEndIso,
    dailyBudgetUsd,
  );

  const priority = await analyzePriorityQueue(supabase, now);

  await maybeSendDailyBriefing(
    supabase,
    adminEmail,
    now,
    dayStartIso,
    dayEndIso,
    todayEt,
    health,
    spend,
    dlqCount,
    priority,
  );

  const metadata: Record<string, unknown> = {
    pipeline_agents: PIPELINE_AGENTS.length,
    health_agents: health.agents,
    overdue_count: health.overdue,
    failing_count: health.failing,
    dlq_unacknowledged: dlqCount,
    estimated_spend_usd_today: spend.spendUsd,
    sonnet_runs_today: spend.sonnetRuns,
    haiku_runs_today: spend.haikuRuns,
    budget_exceeded: spend.exceeded,
    daily_budget_usd: dailyBudgetUsd,
    priority_queue: priority,
  };

  await logAgentRun(supabase, {
    agent_name: "orchestrator",
    run_at: now.toISOString(),
    records_processed: PIPELINE_AGENTS.length,
    status: "success",
    error_message: null,
    metadata,
  });
}

Deno.serve(async (_req: Request) => {
  try {
    await runOrchestrator();
  } catch (e) {
    console.error("orchestrator error", e);
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
