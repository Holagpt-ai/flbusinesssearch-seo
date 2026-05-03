// @ts-expect-error - Deno/Edge import via esm.sh (not resolvable by Node tsc)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve: (
    handler: (req: Request) => Response | Promise<Response>,
  ) => void;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type AlertRuleRow = {
  id: string;
  subscriber_id: string;
  county_ids: unknown;
  keywords: unknown;
  subscribers: { email: string | null; plan_status: string | null };
};

type BusinessRow = {
  id: string;
  name: string | null;
  county: string | null;
  filing_date: string | null;
  category_slug: string | null;
  hot_lead: boolean | null;
  slug: string | null;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isEmptyCountyIds(county_ids: unknown): boolean {
  if (county_ids == null) return true;
  if (Array.isArray(county_ids)) return county_ids.length === 0;
  return false;
}

function isEmptyKeywords(keywords: unknown): boolean {
  if (keywords == null) return true;
  if (Array.isArray(keywords)) return keywords.length === 0;
  return false;
}

function countyIdsIncludeCounty(county_ids: unknown, businessCounty: string): boolean {
  if (!Array.isArray(county_ids) || county_ids.length === 0) return false;
  const target = businessCounty.trim().toLowerCase();
  if (!target) return false;
  for (const id of county_ids) {
    const s = typeof id === "string" ? id : String(id);
    if (s.trim().toLowerCase() === target) return true;
  }
  return false;
}

function keywordAppearsInName(keywords: unknown, businessName: string): boolean {
  if (!Array.isArray(keywords) || keywords.length === 0) return false;
  const lowerName = businessName.toLowerCase();
  for (const kw of keywords) {
    if (typeof kw !== "string") continue;
    const k = kw.trim().toLowerCase();
    if (k.length === 0) continue;
    if (lowerName.includes(k)) return true;
  }
  return false;
}

function businessMatchesRule(rule: AlertRuleRow, business: BusinessRow): boolean {
  const countiesEmpty = isEmptyCountyIds(rule.county_ids);
  const keywordsEmpty = isEmptyKeywords(rule.keywords);
  if (countiesEmpty && keywordsEmpty) return true;

  const bizCounty = (business.county ?? "").trim();
  const bizName = business.name ?? "";

  if (countyIdsIncludeCounty(rule.county_ids, bizCounty)) return true;
  if (keywordAppearsInName(rule.keywords, bizName)) return true;
  return false;
}

async function insertAgentLog(
  supabase: ReturnType<typeof createClient>,
  entry: {
    agent_name: string;
    status: string;
    records_processed?: number;
    message?: string;
    error_message?: string | null;
  },
): Promise<void> {
  const { error } = await supabase.from("agent_logs").insert({
    agent_name: entry.agent_name,
    run_at: new Date().toISOString(),
    records_processed: entry.records_processed ?? 0,
    status: entry.status,
    error_message: entry.error_message ?? null,
    metadata: entry.message != null ? { message: entry.message } : {},
  });
  if (error) throw error;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    await insertAgentLog(supabase, {
      agent_name: "alert-matching-agent",
      status: "running",
      message: "Starting alert matching run",
    });

    const cutoff = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();

    const { data: rulesRaw, error: rulesErr } = await supabase
      .from("alert_rules")
      .select(
        "id, subscriber_id, county_ids, keywords, subscribers!inner(email, plan_status)",
      )
      .eq("active", true)
      .in("subscribers.plan_status", ["active", "waitlist"]);

    if (rulesErr) throw rulesErr;

    const rules = (rulesRaw ?? []) as AlertRuleRow[];

    if (rules.length === 0) {
      await insertAgentLog(supabase, {
        agent_name: "alert-matching-agent",
        status: "success",
        message: "No active alert rules found",
        records_processed: 0,
      });
      return jsonResponse({ success: true, matches: 0, rules: 0 }, 200);
    }

    const { data: businessesRaw, error: bizErr } = await supabase
      .from("businesses")
      .select(
        "id, name, county, filing_date, category_slug, hot_lead, slug",
      )
      .gte("filing_date", cutoff)
      .eq("status", "Active")
      .limit(500);

    if (bizErr) throw bizErr;

    const businesses = (businessesRaw ?? []) as BusinessRow[];

    if (businesses.length === 0) {
      await insertAgentLog(supabase, {
        agent_name: "alert-matching-agent",
        status: "success",
        message: "No new businesses in window",
        records_processed: 0,
      });
      return jsonResponse({
        success: true,
        matches: 0,
        rules: rules.length,
      }, 200);
    }

    let totalMatches = 0;

    for (const rule of rules) {
      for (const business of businesses) {
        if (!businessMatchesRule(rule, business)) continue;

        const row = {
          subscriber_id: rule.subscriber_id,
          business_id: business.id,
          business_name: business.name,
          county: business.county,
          filing_date: business.filing_date,
          category_slug: business.category_slug,
          hot_lead: business.hot_lead ?? false,
          matched_on: new Date().toISOString(),
          email_sent: false,
        };

        const { data: inserted, error: upErr } = await supabase
          .from("alert_matches")
          .upsert(row, {
            onConflict: "subscriber_id,business_id",
            ignoreDuplicates: true,
          })
          .select("id");

        if (upErr) throw upErr;
        if (inserted && inserted.length > 0) totalMatches += inserted.length;
      }
    }

    await insertAgentLog(supabase, {
      agent_name: "alert-matching-agent",
      status: "success",
      message:
        `Matched ${totalMatches} businesses across ${rules.length} active rules`,
      records_processed: totalMatches,
    });

    return jsonResponse({
      success: true,
      matches: totalMatches,
      rules: rules.length,
    }, 200);
  } catch (e) {
    const errText = String(e);
    console.error("alert-matching-agent error", e);
    try {
      const { error: logErr } = await supabase.from("agent_logs").insert({
        agent_name: "alert-matching-agent",
        run_at: new Date().toISOString(),
        records_processed: 0,
        status: "error",
        error_message: errText,
        metadata: {},
      });
      if (logErr) console.error("alert-matching-agent log insert failed", logErr);
    } catch (logEx) {
      console.error("alert-matching-agent log exception", logEx);
    }
    return jsonResponse({ success: false, error: errText }, 500);
  }
});
