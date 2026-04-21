import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentJob, AgentLogEntry } from "./types";

declare const Deno: {
  env: { get(key: string): string | undefined };
};

export async function logAgentRun(
  supabase: SupabaseClient,
  entry: AgentLogEntry,
): Promise<void> {
  const { error } = await supabase.from("agent_logs").insert({
    agent_name: entry.agent_name,
    run_at: entry.run_at,
    records_processed: entry.records_processed,
    status: entry.status,
    error_message: entry.error_message,
    metadata: entry.metadata,
  });
  if (error) throw error;
}

export async function enqueueJob(
  supabase: SupabaseClient,
  job: Omit<AgentJob, "id" | "attempts">,
): Promise<void> {
  const { error } = await supabase.from("agent_queue").insert({
    from_agent: job.from_agent,
    to_agent: job.to_agent,
    job_type: job.job_type,
    payload: job.payload,
    priority: job.priority,
  });
  if (error) throw error;
}

export async function pickNextJob(
  supabase: SupabaseClient,
  agentName: string,
): Promise<AgentJob | null> {
  const { data: pending, error: selErr } = await supabase
    .from("agent_queue")
    .select("id, from_agent, to_agent, job_type, payload, priority, attempts, status")
    .eq("to_agent", agentName)
    .eq("status", "pending")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (selErr) throw selErr;
  if (!pending) return null;

  const nextAttempts = (pending.attempts as number) + 1;
  const { data: updated, error: updErr } = await supabase
    .from("agent_queue")
    .update({
      status: "processing",
      picked_at: new Date().toISOString(),
      attempts: nextAttempts,
    })
    .eq("id", pending.id)
    .eq("status", "pending")
    .select("id, from_agent, to_agent, job_type, payload, priority, attempts")
    .maybeSingle();

  if (updErr) throw updErr;
  if (!updated) return null;

  return {
    id: updated.id as string,
    from_agent: updated.from_agent as string,
    to_agent: updated.to_agent as string,
    job_type: updated.job_type as string,
    payload: (updated.payload ?? {}) as Record<string, unknown>,
    priority: updated.priority as number,
    attempts: updated.attempts as number,
  };
}

export async function completeJob(
  supabase: SupabaseClient,
  jobId: string,
): Promise<void> {
  const { error } = await supabase
    .from("agent_queue")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobId);
  if (error) throw error;
}

export async function failJob(
  supabase: SupabaseClient,
  jobId: string,
  errorMessage: string,
): Promise<void> {
  const { data: row, error: fetchErr } = await supabase
    .from("agent_queue")
    .select(
      "id, from_agent, to_agent, job_type, payload, attempts, max_attempts, status",
    )
    .eq("id", jobId)
    .maybeSingle();

  if (fetchErr) throw fetchErr;
  if (!row) return;

  const attempts = row.attempts as number;
  const maxAttempts = row.max_attempts as number;

  if (attempts >= maxAttempts) {
    const { error: dlqErr } = await supabase.from("dead_letter_queue").insert({
      original_job_id: jobId,
      from_agent: row.from_agent as string,
      to_agent: row.to_agent as string,
      job_type: row.job_type as string,
      payload: row.payload ?? {},
      error_message: errorMessage,
    });
    if (dlqErr) throw dlqErr;

    const { error: updErr } = await supabase
      .from("agent_queue")
      .update({ status: "dead", error_message: errorMessage })
      .eq("id", jobId);
    if (updErr) throw updErr;
    return;
  }

  const { error: pendErr } = await supabase
    .from("agent_queue")
    .update({
      status: "pending",
      error_message: errorMessage,
      picked_at: null,
    })
    .eq("id", jobId);
  if (pendErr) throw pendErr;
}

export async function getKnowledge(
  supabase: SupabaseClient,
  agentName: string,
  knowledgeType: string,
  key: string,
): Promise<unknown | null> {
  const { data, error } = await supabase
    .from("agent_knowledge")
    .select("value")
    .eq("agent_name", agentName)
    .eq("knowledge_type", knowledgeType)
    .eq("key", key)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return data.value;
}

export async function setKnowledge(
  supabase: SupabaseClient,
  agentName: string,
  knowledgeType: string,
  key: string,
  value: unknown,
  confidenceDelta?: number,
): Promise<void> {
  const { data: existing, error: exErr } = await supabase
    .from("agent_knowledge")
    .select("confidence_score, observations")
    .eq("agent_name", agentName)
    .eq("knowledge_type", knowledgeType)
    .eq("key", key)
    .maybeSingle();

  if (exErr) throw exErr;

  const delta = confidenceDelta ?? 0;
  const now = new Date().toISOString();

  if (!existing) {
    const base = 0.5 + delta;
    const confidence = Math.min(1, Math.max(0, base));
    const { error } = await supabase.from("agent_knowledge").insert({
      agent_name: agentName,
      knowledge_type: knowledgeType,
      key,
      value: value as never,
      confidence_score: confidence,
      observations: 1,
      created_at: now,
      updated_at: now,
    });
    if (error) throw error;
    return;
  }

  const prevConf = Number(existing.confidence_score ?? 0.5);
  const nextConf = Math.min(1, Math.max(0, prevConf + delta));
  const nextObs = Number(existing.observations ?? 0) + 1;

  const { error } = await supabase
    .from("agent_knowledge")
    .update({
      value: value as never,
      confidence_score: nextConf,
      observations: nextObs,
      updated_at: now,
    })
    .eq("agent_name", agentName)
    .eq("knowledge_type", knowledgeType)
    .eq("key", key);

  if (error) throw error;
}

export async function sendFailureAlert(
  email: string,
  agentName: string,
  error: string,
): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.warn("sendFailureAlert: RESEND_API_KEY not set");
    return;
  }

  const from =
    Deno.env.get("RESEND_FROM_EMAIL") ?? "onboarding@resend.dev";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: `[FLBusinessSearch Alert] ${agentName} failed — ${error}`,
      text: `Agent: ${agentName}\n\nError:\n${error}`,
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Resend error ${res.status}: ${t}`);
  }
}
