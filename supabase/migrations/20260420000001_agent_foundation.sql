-- Agent queue (agent-to-agent messaging)
CREATE TABLE IF NOT EXISTS agent_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_agent text NOT NULL,
  to_agent text NOT NULL,
  job_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  priority integer NOT NULL DEFAULT 5,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now(),
  picked_at timestamptz,
  completed_at timestamptz,
  error_message text
);

-- Dead letter queue (failed jobs)
CREATE TABLE IF NOT EXISTS dead_letter_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_job_id uuid,
  from_agent text NOT NULL,
  to_agent text NOT NULL,
  job_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  error_message text,
  failed_at timestamptz NOT NULL DEFAULT now(),
  acknowledged boolean NOT NULL DEFAULT false
);

-- Agent knowledge (shared memory layer)
CREATE TABLE IF NOT EXISTS agent_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name text NOT NULL,
  knowledge_type text NOT NULL,
  key text NOT NULL,
  value jsonb NOT NULL,
  confidence_score numeric(4,3) DEFAULT 0.5,
  observations integer DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(agent_name, knowledge_type, key)
);

-- SEO pages (published page registry)
CREATE TABLE IF NOT EXISTS seo_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_type text NOT NULL,
  locale text NOT NULL DEFAULT 'en',
  slug text NOT NULL,
  title text,
  meta_description text,
  content_en text,
  content_es text,
  schema_json jsonb,
  geo_score numeric(4,3),
  uniqueness_score numeric(4,3),
  status text NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(page_type, locale, slug)
);

-- Keyword targets
CREATE TABLE IF NOT EXISTS keyword_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword text NOT NULL,
  locale text NOT NULL DEFAULT 'en',
  county_slug text,
  category_slug text,
  search_volume integer,
  difficulty integer,
  current_position integer,
  target_page_slug text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Rank tracking
CREATE TABLE IF NOT EXISTS rank_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword text NOT NULL,
  locale text NOT NULL DEFAULT 'en',
  position integer,
  page_url text,
  tracked_at timestamptz NOT NULL DEFAULT now()
);

-- Analytics insights
CREATE TABLE IF NOT EXISTS analytics_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_slug text NOT NULL,
  locale text NOT NULL DEFAULT 'en',
  sessions integer DEFAULT 0,
  bounce_rate numeric(5,2),
  avg_time_on_page integer,
  conversions integer DEFAULT 0,
  recorded_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Geo intelligence
CREATE TABLE IF NOT EXISTS geo_intelligence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  county_slug text NOT NULL UNIQUE,
  county_name text NOT NULL,
  population integer,
  major_cities text[],
  dominant_industries text[],
  spanish_speaking_pct numeric(5,2),
  hot_lead_density numeric(5,2),
  top_zip_codes text[],
  regional_classification text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Link opportunities
CREATE TABLE IF NOT EXISTS link_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL,
  page_url text,
  domain_authority integer,
  opportunity_type text,
  notes text,
  status text DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Content drafts
CREATE TABLE IF NOT EXISTS content_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid,
  page_type text NOT NULL,
  locale text NOT NULL DEFAULT 'en',
  slug text,
  title text,
  content text,
  meta_description text,
  faq_blocks jsonb,
  schema_json jsonb,
  uniqueness_score numeric(4,3),
  geo_score numeric(4,3),
  qc_status text DEFAULT 'pending',
  qc_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Agent run logs (required by orchestrator and base utilities)
CREATE TABLE IF NOT EXISTS agent_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name text NOT NULL,
  run_at timestamptz NOT NULL DEFAULT now(),
  records_processed integer NOT NULL DEFAULT 0,
  status text NOT NULL,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_queue_status
  ON agent_queue(status, priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_agent_queue_to_agent
  ON agent_queue(to_agent, status);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_lookup
  ON agent_knowledge(agent_name, knowledge_type, key);
CREATE INDEX IF NOT EXISTS idx_seo_pages_type_locale
  ON seo_pages(page_type, locale, status);
CREATE INDEX IF NOT EXISTS idx_content_drafts_status
  ON content_drafts(qc_status, page_type);
CREATE INDEX IF NOT EXISTS idx_agent_logs_agent_run
  ON agent_logs(agent_name, run_at DESC);
