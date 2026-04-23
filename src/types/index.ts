export interface Business {
  id: string;
  name: string;
  name_normalized: string | null;
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
  gbp_detected: boolean | null;
  hot_lead: boolean | null;
  lead_quality: string | null;
  last_enriched_at: string | null;
  sunbiz_document_number: string | null;
  enrichment_status: string | null;
  annual_report_risk: string | null;
  updated_at: string | null;
  created_at: string | null;
}

export interface County {
  id: string;
  name: string;
  slug: string;
  business_count: number | null;
  created_at: string | null;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  business_count: number | null;
  created_at: string | null;
}

export type Locale = "en" | "es";
