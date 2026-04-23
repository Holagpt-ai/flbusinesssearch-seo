export interface AgentJob {
  id: string;
  from_agent: string;
  to_agent: string;
  job_type: string;
  payload: Record<string, unknown>;
  priority: number;
  attempts: number;
}

export interface AgentLogEntry {
  agent_name: string;
  run_at: string;
  records_processed: number;
  status: "success" | "partial" | "error" | "skipped";
  error_message: string | null;
  metadata: Record<string, unknown>;
}

export interface AgentKnowledge {
  agent_name: string;
  knowledge_type: string;
  key: string;
  value: unknown;
  confidence_score: number;
  observations: number;
}

export interface BusinessRecord {
  id: string;
  name: string;
  slug: string;
  entity_type: string | null;
  status: string | null;
  filing_date: string | null;
  county: string | null;
  county_slug: string | null;
  owner_name: string | null;
  owner_address: string | null;
  registered_agent: string | null;
  category: string | null;
  category_slug: string | null;
  website_url: string | null;
  website_detected: boolean | null;
  hot_lead: boolean | null;
  lead_quality: string | null;
  sunbiz_document_number: string | null;
  enrichment_status: string | null;
  annual_report_risk: string | null;
}

export type AgentTier = "hot" | "warm" | "basic";

export type AgentStatus = "running" | "idle" | "error" | "scheduled";
