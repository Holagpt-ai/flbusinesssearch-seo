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
  enrichment_status: string | null;
  category: string | null;
  category_slug: string | null;
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

  // ── Helper: word-boundary check ──────────────────────────────────────────
  // Returns true if `word` appears as a standalone token in `str`.
  // Avoids false positives like "lawn" matching "law", "therapy" matching "therapist" etc.
  function hasWord(str: string, word: string): boolean {
    const idx = str.indexOf(word);
    if (idx === -1) return false;
    const before = idx === 0 ? true : !/[a-z0-9]/.test(str[idx - 1]);
    const after = idx + word.length >= str.length ? true : !/[a-z0-9]/.test(str[idx + word.length]);
    return before && after;
  }

  // ── Rules — evaluated top-to-bottom; first match wins ────────────────────
  // Ordering is deliberate: specific industries before broader catch-alls.
  // Generic words (services, group, solutions, management, global, american,
  // national, florida, us, digital, web, care, tech) are intentionally excluded
  // — they appear across all business types and produce false positives.

  // 1. Legal Services — "law" is word-boundary only to avoid "lawn", "lawson"
  if (
    hasWord(n, "law") ||
    n.includes("attorney") ||
    n.includes("esquire") ||
    n.includes(" llp") ||
    n.includes("paralegal") ||
    n.includes("notary public") ||
    n.includes("legal counsel") ||
    n.includes("law firm") ||
    n.includes("legal aid") ||
    n.includes("litigation") ||
    n.includes("tort") ||
    n.includes("barrister")
  ) return { category: "Legal Services", category_slug: "legal-services" };

  // 2. Healthcare — specific clinical terms; "care" excluded (too generic)
  if (
    n.includes("medical") ||
    n.includes("dental") ||
    n.includes("clinic") ||
    n.includes("chiropractic") ||
    n.includes("chiropract") ||
    n.includes("therapy") ||
    n.includes("therapist") ||
    n.includes("pharmacy") ||
    n.includes("rehab") ||
    n.includes("urgent care") ||
    n.includes("physician") ||
    n.includes("surgeon") ||
    n.includes("surgery") ||
    n.includes("pediatric") ||
    n.includes("orthodont") ||
    n.includes("optometr") ||
    n.includes("ophthalmol") ||
    n.includes("nursing") ||
    n.includes("hospice") ||
    n.includes("radiology") ||
    n.includes("dermatol") ||
    n.includes("cardiolog") ||
    n.includes("psychiatr") ||
    n.includes("psycholog") ||
    n.includes("counseling") ||
    n.includes("mental health") ||
    n.includes("acupuncture") ||
    n.includes("midwife") ||
    n.includes("dialysis") ||
    n.includes("orthopedic") ||
    n.includes("neurol")
  ) return { category: "Healthcare", category_slug: "healthcare" };

  // 3. Insurance — "coverage" and "claims" excluded (appear in non-insurance names)
  if (
    n.includes("insurance") ||
    n.includes("insure") ||
    n.includes("underwriting") ||
    n.includes("surety bond") ||
    n.includes("adjuster") ||
    n.includes("reinsurance") ||
    n.includes("annuity") ||
    n.includes("insurtech")
  ) return { category: "Insurance", category_slug: "insurance" };

  // 4. Real Estate — "property" and "title" excluded (too ambiguous alone)
  if (
    n.includes("realty") ||
    n.includes("realtor") ||
    n.includes("real estate") ||
    n.includes("property management") ||
    n.includes("property mgmt") ||
    n.includes("mortgage") ||
    n.includes("title company") ||
    n.includes("title ins") ||
    n.includes("home sales") ||
    n.includes("land sales") ||
    n.includes("apartment") ||
    n.includes("leasing") ||
    n.includes("condos") ||
    n.includes("homebuilder") ||
    n.includes("land developer") ||
    n.includes("reit")
  ) return { category: "Real Estate", category_slug: "real-estate" };

  // 5. Construction — broad but specific compound terms
  if (
    n.includes("construction") ||
    n.includes("builder") ||
    n.includes("contractor") ||
    n.includes("remodel") ||
    n.includes("roofing") ||
    n.includes("concrete") ||
    n.includes("flooring") ||
    n.includes("drywall") ||
    n.includes("stucco") ||
    n.includes("plumbing") ||
    n.includes("electrical") ||
    n.includes("hvac") ||
    n.includes("air conditioning") ||
    n.includes("paving") ||
    n.includes("fencing") ||
    n.includes("painting") ||
    n.includes("excavat") ||
    n.includes("masonry") ||
    n.includes("tile install") ||
    n.includes("tile contract") ||
    n.includes("carpentry") ||
    n.includes("renovation") ||
    n.includes("framing") ||
    n.includes("waterproof") ||
    n.includes("demolition") ||
    n.includes("grading") ||
    n.includes("sitework") ||
    n.includes("septic install") ||
    n.includes("foundation repair") ||
    n.includes("fire protection")
  ) return { category: "Construction", category_slug: "construction" };

  // 6. Landscaping — before Home Services to capture "lawn care" correctly
  if (
    n.includes("landscaping") ||
    n.includes("lawn care") ||
    n.includes("lawn service") ||
    n.includes("lawn maint") ||
    n.includes("lawn mow") ||
    n.includes("irrigation") ||
    n.includes("tree service") ||
    n.includes("tree trim") ||
    n.includes("tree remov") ||
    n.includes("sod install") ||
    n.includes("sod farm") ||
    n.includes("mulching") ||
    n.includes("horticulture") ||
    n.includes("garden") ||
    n.includes("arborist") ||
    n.includes("turf")
  ) return { category: "Landscaping", category_slug: "landscaping" };

  // 7. Home Services — maintenance/repair, distinct from Construction (building)
  if (
    n.includes("handyman") ||
    n.includes("home repair") ||
    n.includes("appliance repair") ||
    n.includes("locksmith") ||
    n.includes("garage door") ||
    n.includes("window install") ||
    n.includes("pool service") ||
    n.includes("pool clean") ||
    n.includes("pool repair") ||
    n.includes("pest control") ||
    n.includes("exterminator") ||
    n.includes("termite") ||
    n.includes("water treatment") ||
    n.includes("water softener") ||
    n.includes("chimney") ||
    n.includes("gutter") ||
    n.includes("pressure clean") ||
    n.includes("home inspect") ||
    n.includes("mold remov") ||
    n.includes("air duct") ||
    n.includes("dryer vent")
  ) return { category: "Home Services", category_slug: "home-services" };

  // 8. Automotive — before Transportation to catch "auto transport"
  if (
    n.includes("auto repair") ||
    n.includes("auto body") ||
    n.includes("auto detailing") ||
    n.includes("auto sales") ||
    n.includes("auto electric") ||
    n.includes("car wash") ||
    n.includes("car dealer") ||
    n.includes("car rental") ||
    n.includes("vehicle repair") ||
    n.includes("vehicle wrap") ||
    n.includes("towing") ||
    n.includes("mechanic") ||
    hasWord(n, "tire") ||
    n.includes("transmission") ||
    n.includes("body shop") ||
    n.includes("motorcycle") ||
    n.includes("motorcy") ||
    n.includes("lube") ||
    n.includes("windshield") ||
    n.includes("auto glass") ||
    n.includes("brake")
  ) return { category: "Automotive", category_slug: "automotive" };

  // 9. Transportation — "transport" alone is fine here after Automotive is checked
  if (
    n.includes("trucking") ||
    n.includes("logistics") ||
    n.includes("freight") ||
    n.includes("hauling") ||
    n.includes("moving company") ||
    n.includes("movers") ||
    n.includes("delivery service") ||
    n.includes("courier") ||
    n.includes("dispatch") ||
    hasWord(n, "fleet") ||
    n.includes("shipping") ||
    n.includes("cargo") ||
    n.includes("transport") ||
    n.includes("chauffeur") ||
    n.includes("limo") ||
    n.includes("taxi") ||
    n.includes("rideshare") ||
    n.includes("non-emergency medical transport") ||
    n.includes("nemt")
  ) return { category: "Transportation", category_slug: "transportation" };

  // 10. Food & Beverage — "food" alone excluded (fires on "food pantry", non-profits)
  if (
    n.includes("restaurant") ||
    n.includes("cafe") ||
    n.includes("catering") ||
    n.includes("bistro") ||
    n.includes("grill") ||
    n.includes("pizza") ||
    n.includes("taco") ||
    n.includes("sushi") ||
    n.includes("bakery") ||
    n.includes("bake shop") ||
    n.includes("deli") ||
    hasWord(n, "bbq") ||
    n.includes("seafood") ||
    n.includes("food truck") ||
    n.includes("brewery") ||
    n.includes("winery") ||
    n.includes("juice bar") ||
    n.includes("coffee shop") ||
    n.includes("coffeehouse") ||
    n.includes("sandwich shop") ||
    n.includes("burger") ||
    n.includes("fried chicken") ||
    n.includes("cuban food") ||
    n.includes("boba") ||
    n.includes("buffet") ||
    n.includes("steakhouse") ||
    n.includes("food hall") ||
    n.includes("distillery") ||
    n.includes("taproom")
  ) return { category: "Food & Beverage", category_slug: "food-beverage" };

  // 11. Cleaning Services — "clean" alone excluded (fires on "clean energy")
  if (
    n.includes("cleaning service") ||
    n.includes("cleaning co") ||
    n.includes("cleaning llc") ||
    n.includes("janitorial") ||
    n.includes("maid service") ||
    n.includes("pressure washing") ||
    n.includes("power washing") ||
    n.includes("sanitation") ||
    n.includes("disinfect") ||
    n.includes("housekeeping") ||
    n.includes("carpet clean") ||
    n.includes("window clean") ||
    n.includes("office clean") ||
    n.includes("commercial clean") ||
    n.includes("residential clean") ||
    n.includes("deep clean")
  ) return { category: "Cleaning Services", category_slug: "cleaning-services" };

  // 12. Beauty & Wellness — "spa" and "nail" checked with word-boundary or compound
  if (
    n.includes("salon") ||
    n.includes("day spa") ||
    n.includes("med spa") ||
    hasWord(n, "spa") ||
    n.includes("beauty") ||
    n.includes("nail salon") ||
    n.includes("nail studio") ||
    hasWord(n, "nails") ||
    n.includes("barber") ||
    n.includes("cosmetology") ||
    n.includes("esthetics") ||
    n.includes("lashes") ||
    n.includes("waxing") ||
    n.includes("massage") ||
    n.includes("hair studio") ||
    n.includes("hair salon") ||
    n.includes("eyebrow") ||
    n.includes("microblading") ||
    n.includes("tattoo") ||
    n.includes("piercing") ||
    n.includes("blowout") ||
    n.includes("skincare") ||
    n.includes("skin care") ||
    n.includes("medspa")
  ) return { category: "Beauty & Wellness", category_slug: "beauty-wellness" };

  // 13. Technology — "web" and "tech" excluded (too broad); use compound terms only
  if (
    n.includes("software") ||
    n.includes("saas") ||
    n.includes("cyber") ||
    n.includes("cloud computing") ||
    n.includes("it service") ||
    n.includes("information technology") ||
    n.includes("data analytic") ||
    n.includes("app developer") ||
    n.includes("app develop") ||
    n.includes("tech support") ||
    n.includes("network admin") ||
    n.includes("managed service") ||
    n.includes("machine learning") ||
    n.includes("artificial intelligence") ||
    n.includes("programming") ||
    n.includes("web develop") ||
    n.includes("web design") ||
    n.includes("mobile app") ||
    n.includes("devops") ||
    n.includes("data center") ||
    n.includes("telecom") ||
    n.includes("helpdesk") ||
    n.includes("it consult")
  ) return { category: "Technology", category_slug: "technology" };

  // 14. Marketing & Advertising
  if (
    n.includes("marketing") ||
    n.includes("advertising") ||
    n.includes("media agency") ||
    n.includes("branding") ||
    n.includes("public relations") ||
    n.includes("seo agency") ||
    n.includes("social media") ||
    n.includes("creative agency") ||
    n.includes("ad agency") ||
    n.includes("pr firm") ||
    n.includes("content market") ||
    n.includes("influencer") ||
    n.includes("graphic design") ||
    n.includes("video product") ||
    n.includes("photography")
  ) return { category: "Marketing & Advertising", category_slug: "marketing-advertising" };

  // 15. Accounting & Finance — " cpa " with spaces to avoid false positives
  if (
    n.includes("accounting") ||
    n.includes("bookkeeping") ||
    n.includes(" cpa ") ||
    n.startsWith("cpa ") ||
    n.includes(", cpa") ||
    n.includes("tax preparation") ||
    n.includes("tax service") ||
    n.includes("tax consult") ||
    n.includes("payroll") ||
    n.includes("financial planning") ||
    n.includes("wealth management") ||
    n.includes("investment advisor") ||
    n.includes("credit repair") ||
    n.includes("debt settlement") ||
    n.includes("financial advisor") ||
    n.includes("certified public accountant") ||
    n.includes("audit firm") ||
    n.includes("cfo service")
  ) return { category: "Accounting & Finance", category_slug: "accounting-finance" };

  // 16. Education
  if (
    n.includes("school") ||
    n.includes("academy") ||
    n.includes("tutoring") ||
    n.includes("training center") ||
    n.includes("childcare") ||
    n.includes("child care") ||
    n.includes("daycare") ||
    n.includes("day care") ||
    n.includes("preschool") ||
    n.includes("montessori") ||
    n.includes("learning center") ||
    n.includes("driving school") ||
    n.includes("dance school") ||
    n.includes("dance studio") ||
    n.includes("martial arts") ||
    n.includes("after school") ||
    n.includes("vocational") ||
    n.includes("language school") ||
    n.includes("music school") ||
    n.includes("music lesson") ||
    n.includes("stem program")
  ) return { category: "Education", category_slug: "education" };

  // 17. Retail — specific compound terms; "store" alone excluded
  if (
    n.includes("boutique") ||
    n.includes("clothing store") ||
    n.includes("apparel") ||
    n.includes("jewelry store") ||
    n.includes("gift shop") ||
    n.includes("hardware store") ||
    n.includes("furniture store") ||
    n.includes("wholesale") ||
    n.includes("import export") ||
    n.includes("trading co") ||
    n.includes("smoke shop") ||
    n.includes("vape") ||
    n.includes("dispensary") ||
    n.includes("thrift") ||
    n.includes("consignment") ||
    n.includes("pawn shop") ||
    n.includes("sporting goods") ||
    n.includes("pet store") ||
    n.includes("toy store") ||
    n.includes("book store") ||
    n.includes("bookstore") ||
    n.includes("convenience store")
  ) return { category: "Retail", category_slug: "retail" };

  // 18. Professional Services — broad catch-all for B2B firms;
  // placed late so more specific categories match first
  if (
    n.includes("consulting") ||
    n.includes("staffing") ||
    n.includes("recruiting") ||
    n.includes("engineering firm") ||
    n.includes("architecture") ||
    n.includes("surveying") ||
    n.includes("hr consulting") ||
    n.includes("business consulting") ||
    n.includes("management consulting") ||
    n.includes("environmental") ||
    n.includes("civil engineer") ||
    n.includes("structural engineer") ||
    n.includes("mechanical engineer") ||
    n.includes("event planning") ||
    n.includes("event management") ||
    n.includes("security guard") ||
    n.includes("security service") ||
    n.includes("private investigat") ||
    n.includes("translation") ||
    n.includes("interpreter")
  ) return { category: "Professional Services", category_slug: "professional-services" };

  // 19. Non-Profit & Religious
  if (
    n.includes("church") ||
    n.includes("ministry") ||
    n.includes("ministries") ||
    n.includes("foundation") ||
    n.includes("nonprofit") ||
    n.includes("non-profit") ||
    n.includes("charity") ||
    n.includes("outreach") ||
    n.includes("fellowship") ||
    n.includes("mosque") ||
    n.includes("synagogue") ||
    n.includes("temple") ||
    n.includes("mission") ||
    n.includes("faith") ||
    n.includes("diocese") ||
    n.includes("parish") ||
    n.includes("humanitarian")
  ) return { category: "Non-Profit & Religious", category_slug: "nonprofit-religious" };

  // 20. General Business — catch-all
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
      .select(
        "id, name, filing_date, county, county_slug, registered_agent, enrichment_status, category, category_slug",
      )
      .in("id", params.businessIds);
    if (error) throw error;
    rows = (data ?? []) as BusinessRow[];
  } else {
    const { data, error } = await supabase
      .from("businesses")
      .select(
        "id, name, filing_date, county, county_slug, registered_agent, enrichment_status, category, category_slug",
      )
      .in("enrichment_status", ["pending", "website_pending"])
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

      const isWebsitePending = r.enrichment_status === "website_pending";
      const categoryUpdate = isWebsitePending
        ? {}
        : { category, category_slug };

      const nowIso = new Date().toISOString();
      const { error: upErr } = await supabase
        .from("businesses")
        .update({
          website_detected: website.website_detected,
          website_url: website.website_url,
          county,
          county_slug,
          ...categoryUpdate,
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

