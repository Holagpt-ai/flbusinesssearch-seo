-- Agent 1: deduplication key from Sunbiz fixed-width file
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS sunbiz_document_number TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_businesses_sunbiz_doc_number
  ON businesses(sunbiz_document_number)
  WHERE sunbiz_document_number IS NOT NULL;

-- Agent 2: enrichment pipeline state machine
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS enrichment_status TEXT NOT NULL DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_businesses_enrichment_status
  ON businesses(enrichment_status)
  WHERE enrichment_status = 'pending';

-- Agent 2: annual report risk scoring output
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS annual_report_risk TEXT;

