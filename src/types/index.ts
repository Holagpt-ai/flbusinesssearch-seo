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
  registered_agent_name: string | null;
  registered_agent_street: string | null;
  registered_agent_city: string | null;
  registered_agent_state: string | null;
  registered_agent_zip: string | null;
  officers: {
    title: string | null;
    name: string | null;
    street: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
  }[] | null;
  fei_ein: string | null;
  state_of_formation: string | null;
  last_event_date: string | null;
  mailing_street: string | null;
  mailing_city: string | null;
  mailing_state: string | null;
  mailing_zip: string | null;
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
