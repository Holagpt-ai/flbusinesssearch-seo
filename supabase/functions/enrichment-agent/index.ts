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

type EnrichmentRequestBody = {
  business_ids?: string[];
  triggered_by?: string;
};

type BusinessRow = {
  id: string;
  name: string | null;
  filing_date: string | null;
  county: string | null;
  county_slug: string | null;
  registered_agent: string | null;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function slugifyName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function toCountySlug(county: string): string {
  return county.toLowerCase().replace(/\s+/g, "-");
}

function normalizeCity(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

function extractLikelyCity(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  const parts = t.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 2] || null;
  return null;
}

// Representative city -> county mapping covering all 67 FL counties.
// Values are county names (human-readable); slug derived separately.
const COUNTY_LOOKUP: Record<string, string> = {
  // Alachua
  "gainesville": "Alachua",
  // Baker
  "macclenny": "Baker",
  // Bay
  "panama city": "Bay",
  // Bradford
  "starke": "Bradford",
  // Brevard
  "melbourne": "Brevard",
  "cocoa": "Brevard",
  "titusville": "Brevard",
  // Broward
  "fort lauderdale": "Broward",
  "hollywood": "Broward",
  "pompano beach": "Broward",
  "deerfield beach": "Broward",
  // Calhoun
  "blountstown": "Calhoun",
  // Charlotte
  "punta gorda": "Charlotte",
  // Citrus
  "inverness": "Citrus",
  // Clay
  "green cove springs": "Clay",
  // Collier
  "naples": "Collier",
  "marco island": "Collier",
  // Columbia
  "lake city": "Columbia",
  // DeSoto
  "arcadia": "DeSoto",
  // Dixie
  "cross city": "Dixie",
  // Duval
  "jacksonville": "Duval",
  // Escambia
  "pensacola": "Escambia",
  // Flagler
  "bunnell": "Flagler",
  "palm coast": "Flagler",
  // Franklin
  "apalachicola": "Franklin",
  // Gadsden
  "quincy": "Gadsden",
  // Gilchrist
  "trenton": "Gilchrist",
  // Glades
  "moore haven": "Glades",
  // Gulf
  "port saint joe": "Gulf",
  // Hamilton
  "jasper": "Hamilton",
  // Hardee
  "waunchula": "Hardee",
  // Hendry
  "labelle": "Hendry",
  // Hernando
  "brooksville": "Hernando",
  // Highlands
  "sebring": "Highlands",
  // Hillsborough
  "tampa": "Hillsborough",
  // Holmes
  "bonifay": "Holmes",
  // Indian River
  "vero beach": "Indian River",
  // Jackson
  "marianna": "Jackson",
  // Jefferson
  "monticello": "Jefferson",
  // Lafayette
  "mayo": "Lafayette",
  // Lake
  "tavares": "Lake",
  "leesburg": "Lake",
  // Lee
  "cape coral": "Lee",
  "fort myers": "Lee",
  "bonita springs": "Lee",
  "estero": "Lee",
  // Leon
  "tallahassee": "Leon",
  // Levy
  "bronson": "Levy",
  // Liberty
  "bristol": "Liberty",
  // Madison
  "madison": "Madison",
  // Manatee
  "bradenton": "Manatee",
  // Marion
  "ocala": "Marion",
  // Martin
  "stuart": "Martin",
  // Miami-Dade
  "miami": "Miami-Dade",
  "coral gables": "Miami-Dade",
  "hialeah": "Miami-Dade",
  "miami beach": "Miami-Dade",
  // Monroe
  "key west": "Monroe",
  // Nassau
  "fernandina beach": "Nassau",
  // Okaloosa
  "crestview": "Okaloosa",
  "fort walton beach": "Okaloosa",
  // Okeechobee
  "okeechobee": "Okeechobee",
  // Orange
  "orlando": "Orange",
  // Osceola
  "kissimmee": "Osceola",
  // Palm Beach
  "west palm beach": "Palm Beach",
  "boca raton": "Palm Beach",
  "boynton beach": "Palm Beach",
  "delray beach": "Palm Beach",
  // Pasco
  "dade city": "Pasco",
  "new port richey": "Pasco",
  // Pinellas
  "st petersburg": "Pinellas",
  "saint petersburg": "Pinellas",
  "clearwater": "Pinellas",
  // Polk
  "lakeland": "Polk",
  "bartow": "Polk",
  // Putnam
  "palatka": "Putnam",
  // Saint Johns
  "st augustine": "Saint Johns",
  "saint augustine": "Saint Johns",
  // Saint Lucie
  "fort pierce": "Saint Lucie",
  "port st lucie": "Saint Lucie",
  "port saint lucie": "Saint Lucie",
  // Santa Rosa
  "milton": "Santa Rosa",
  // Sarasota
  "sarasota": "Sarasota",
  // Seminole
  "sanford": "Seminole",
  // Sumter
  "bushnell": "Sumter",
  // Suwannee
  "live oak": "Suwannee",
  // Taylor
  "perry": "Taylor",
  // Union
  "lake butler": "Union",
  // Volusia
  "daytona beach": "Volusia",
  "ormond beach": "Volusia",
  "deland": "Volusia",
  // Wakulla
  "crawfordville": "Wakulla",
  // Walton
  "de funiak springs": "Walton",
  // Washington
  "chipley": "Washington",

  // Additional common cities / county seats to round out coverage
  "pensacola beach": "Escambia",
  "winter haven": "Polk",
  "plant city": "Hillsborough",
  "spring hill": "Hernando",
  "naples park": "Collier",
  "homestead": "Miami-Dade",
  "doral": "Miami-Dade",
  "cutler bay": "Miami-Dade",
  "hialeah gardens": "Miami-Dade",
  "north miami": "Miami-Dade",
  "north miami beach": "Miami-Dade",
  "aventura": "Miami-Dade",
  "miramar": "Broward",
  "sunrise": "Broward",
  "plantation": "Broward",
  "davie": "Broward",
  "coconut creek": "Broward",
  "coral springs": "Broward",
  "margate": "Broward",
  "weston": "Broward",
  "boynton bch": "Palm Beach",
  "palm beach gardens": "Palm Beach",
  "jupiter": "Palm Beach",
  "wellington": "Palm Beach",
  "royal palm beach": "Palm Beach",
  "riviera beach": "Palm Beach",
  "lake worth": "Palm Beach",
  "lake worth beach": "Palm Beach",
  "port orange": "Volusia",
  "new smyrna beach": "Volusia",
  "melbourne beach": "Brevard",
  "rockledge": "Brevard",
  "palm bay": "Brevard",
  "vero bch": "Indian River",
  "ft myers": "Lee",
  "ft lauderdale": "Broward",
  "st pete": "Pinellas",
};

function countyFromCity(cityRaw: string | null | undefined): string | null {
  const city = cityRaw ? normalizeCity(cityRaw) : "";
  if (!city) return null;
  return COUNTY_LOOKUP[city] ?? null;
}

async function detectWebsite(businessName: string): Promise<{
  website_detected: boolean;
  website_url: string | null;
}> {
  const slug = slugifyName(businessName);
  if (!slug) return { website_detected: false, website_url: null };
  const endsWithLlc = /\bllc\b/i.test(businessName.trim());

  const candidates = [
    `https://www.${slug}.com`,
    `https://${slug}.com`,
    ...(endsWithLlc ? [] : [`https://www.${slug}llc.com`]),
    `https://${slug}fl.com`,
  ];

  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        method: "HEAD",
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok || res.status === 301 || res.status === 302) {
        return { website_detected: true, website_url: url };
      }
    } catch {
      // never throw on website detection failures
    }
  }
  return { website_detected: false, website_url: null };
}

function classifyCategory(businessName: string): {
  category: string;
  category_slug: string;
} {
  const n = businessName.toLowerCase();

  const rules: Array<{ keywords: string[]; category: string; slug: string }> = [
    {
      keywords: [
        "construction",
        "builder",
        "contractor",
        "remodel",
        "roofing",
        "concrete",
        "flooring",
      ],
      category: "Construction",
      slug: "construction",
    },
    {
      keywords: [
        "restaurant",
        "cafe",
        "catering",
        "food",
        "kitchen",
        "bistro",
        "grill",
        "pizza",
        "taco",
        "sushi",
      ],
      category: "Food & Beverage",
      slug: "food-beverage",
    },
    {
      keywords: ["insurance", "insure", "coverage", "claims"],
      category: "Insurance",
      slug: "insurance",
    },
    {
      keywords: [
        "realty",
        "real estate",
        "property",
        "homes",
        "realtor",
        "mortgage",
        "title",
      ],
      category: "Real Estate",
      slug: "real-estate",
    },
    {
      keywords: ["law", "legal", "attorney", "counsel", "firm llp", "esquire"],
      category: "Legal Services",
      slug: "legal-services",
    },
    {
      keywords: ["clean", "janitorial", "maid", "pressure wash", "sanitation"],
      category: "Cleaning Services",
      slug: "cleaning-services",
    },
    {
      keywords: [
        "transport",
        "trucking",
        "logistics",
        "freight",
        "hauling",
        "moving",
        "delivery",
      ],
      category: "Transportation",
      slug: "transportation",
    },
    {
      keywords: [
        "health",
        "medical",
        "clinic",
        "dental",
        "therapy",
        "wellness",
        "care",
        "pharmacy",
        "chiro",
      ],
      category: "Healthcare",
      slug: "healthcare",
    },
    {
      keywords: [
        "tech",
        "software",
        "digital",
        "web",
        "app",
        "it services",
        "cyber",
        "solutions llc",
      ],
      category: "Technology",
      slug: "technology",
    },
    {
      keywords: [
        "salon",
        "spa",
        "beauty",
        "nail",
        "barber",
        "cosmetology",
        "esthetics",
      ],
      category: "Beauty & Wellness",
      slug: "beauty-wellness",
    },
  ];

  for (const r of rules) {
    if (r.keywords.some((k) => n.includes(k))) {
      return { category: r.category, category_slug: r.slug };
    }
  }
  return { category: "General Business", category_slug: "general-business" };
}

function annualReportRisk(filingDate: string | null): "low" | "medium" | "high" {
  const today = new Date();
  const currentYear = today.getFullYear();
  const deadline = new Date(currentYear, 3, 30);
  const daysToDeadline = Math.floor(
    (deadline.getTime() - today.getTime()) / 86400000,
  );
  const filingYear = parseInt(filingDate?.substring(0, 4) ?? "0");

  if (filingYear === currentYear) return "low";
  if (daysToDeadline < 0) return "high";
  if (daysToDeadline <= 30) return "medium";
  return "low";
}

function isWithinLastDays(isoDate: string | null, days: number): boolean {
  if (!isoDate) return false;
  const dt = new Date(isoDate);
  if (Number.isNaN(dt.getTime())) return false;
  const ms = Date.now() - dt.getTime();
  return ms >= 0 && ms <= days * 86400000;
}

async function runEnrichmentAgent(params: {
  businessIds?: string[];
  triggeredBy: string;
}): Promise<{
  ok: boolean;
  attempted: number;
  enriched: number;
  errors: number;
  websites_detected: number;
  hot_leads_found: number;
}> {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error(
      "enrichment-agent: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  const supabase = createClient(url, key);
  const startedAt = Date.now();

  let rows: BusinessRow[] = [];
  if (params.businessIds && params.businessIds.length > 0) {
    const { data, error } = await supabase
      .from("businesses")
      .select("id, name, filing_date, county, county_slug, registered_agent")
      .in("id", params.businessIds);
    if (error) throw error;
    rows = (data ?? []) as BusinessRow[];
  } else {
    const { data, error } = await supabase
      .from("businesses")
      .select("id, name, filing_date, county, county_slug, registered_agent")
      .eq("enrichment_status", "pending")
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throw error;
    rows = (data ?? []) as BusinessRow[];
  }

  let attempted = 0;
  let enriched = 0;
  let errors = 0;
  let websitesDetected = 0;
  let hotLeadsFound = 0;

  for (const r of rows) {
    attempted += 1;
    try {
      const name = (r.name ?? "").trim();
      if (!name) throw new Error("missing business name");

      // Step 1 — Website Detection
      const website = await detectWebsite(name);
      if (website.website_detected) websitesDetected += 1;

      // Step 2 — County Normalization
      let county = r.county;
      if (!county) {
        const raCity = extractLikelyCity(r.registered_agent ?? "");
        county = countyFromCity(raCity);
      }
      const county_slug = county ? toCountySlug(county) : null;

      // Step 3 — Category Classification
      const { category, category_slug } = classifyCategory(name);

      // Step 4 — Annual Report Risk
      const annual_report_risk = annualReportRisk(r.filing_date);

      // Step 5 — Hot Lead
      const filingRecent = isWithinLastDays(r.filing_date, 7);
      const hot_lead = website.website_detected === false && filingRecent;
      const lead_quality = hot_lead
        ? "hot"
        : (website.website_detected === false ? "warm" : "basic");
      if (hot_lead) hotLeadsFound += 1;

      const nowIso = new Date().toISOString();
      const { error: upErr } = await supabase
        .from("businesses")
        .update({
          website_detected: website.website_detected,
          website_url: website.website_url,
          county,
          county_slug,
          category,
          category_slug,
          annual_report_risk,
          hot_lead,
          lead_quality,
          enrichment_status: "complete",
          last_enriched_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", r.id);
      if (upErr) throw upErr;

      enriched += 1;
      if (enriched % 50 === 0) {
        console.log(
          `enrichment-agent progress: enriched=${enriched} attempted=${attempted} errors=${errors}`,
        );
      }
    } catch (e) {
      errors += 1;
      console.error("enrichment-agent record error", { id: r.id, error: String(e) });
    }
  }

  const status: "success" | "partial" | "error" = errors === 0
    ? "success"
    : (enriched > 0 ? "partial" : "error");

  const runDurationMs = Date.now() - startedAt;
  const { error: logErr } = await supabase.from("agent_logs").insert({
    agent_name: "enrichment-agent",
    run_at: new Date().toISOString(),
    records_processed: enriched,
    status,
    error_message: errors > 0 ? `errors=${errors}` : null,
    metadata: {
      triggered_by: params.triggeredBy,
      total_attempted: attempted,
      total_enriched: enriched,
      total_errors: errors,
      websites_detected: websitesDetected,
      hot_leads_found: hotLeadsFound,
      run_duration_ms: runDurationMs,
    },
  });
  if (logErr) console.error("enrichment-agent log error", logErr);

  return {
    ok: status !== "error",
    attempted,
    enriched,
    errors,
    websites_detected: websitesDetected,
    hot_leads_found: hotLeadsFound,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    let body: EnrichmentRequestBody = {};
    try {
      if (req.headers.get("content-type")?.includes("application/json")) {
        body = (await req.json()) as EnrichmentRequestBody;
      }
    } catch {
      body = {};
    }

    const business_ids = Array.isArray(body.business_ids)
      ? body.business_ids.filter((x) => typeof x === "string" && x.length > 0)
      : undefined;
    const triggered_by = typeof body.triggered_by === "string" && body.triggered_by
      ? body.triggered_by
      : "unknown";

    const result = await runEnrichmentAgent({
      businessIds: business_ids,
      triggeredBy: triggered_by,
    });

    return jsonResponse({ ok: true, result }, 200);
  } catch (e) {
    console.error("enrichment-agent error", e);
    return jsonResponse({ ok: false, error: String(e) }, 500);
  }
});

