/* eslint-disable no-console */

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const readline = require("readline");

const SftpClient = require("ssh2-sftp-client");
const AdmZip = require("adm-zip");
const { createClient } = require("@supabase/supabase-js");

const DAILY_ZIP_PATH = "/Public/doc/cor/cordata.zip";
const QUARTERLY_ZIP_PATH = "/Public/doc/Quarterly/Cor/cordata.zip";
const RECORD_LENGTH = 1440;
const BATCH_SIZE = 500;

function requireEnv(key) {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env var: ${key}`);
  return v;
}

function safeTrim(s) {
  return String(s ?? "").trim();
}

function normalizeStatus(code2) {
  return code2 === "AC" ? "Active" : "Inactive";
}

function normalizeEntityType(code3) {
  const raw = safeTrim(code3);
  if (raw === "LLC") return "LLC";
  if (raw === "COR") return "Corp";
  if (raw === "LP") return "LP";
  if (raw === "PA") return "PA";
  if (raw === "NP") return "NP";
  return raw;
}

function yyyymmddToIso(yyyymmdd) {
  const s = safeTrim(yyyymmdd);
  if (!/^\d{8}$/.test(s)) return null;
  const y = s.slice(0, 4);
  const m = s.slice(4, 6);
  const d = s.slice(6, 8);
  return `${y}-${m}-${d}`;
}

function nameNormalized(name) {
  return safeTrim(name).toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
}

function slugFrom(nameNorm, countySlug) {
  const base = safeTrim(nameNorm).replace(/\s+/g, "-");
  if (!base) return null;
  return countySlug ? `${base}-${countySlug}` : base;
}

function toCountySlug(county) {
  return county.toLowerCase().replace(/\s+/g, "-");
}

function normalizeCity(raw) {
  return safeTrim(raw).toLowerCase().replace(/\s+/g, " ");
}

// Representative city -> county mapping covering all 67 Florida counties.
const COUNTY_LOOKUP = {
  "gainesville": "Alachua",
  "macclenny": "Baker",
  "panama city": "Bay",
  "starke": "Bradford",
  "melbourne": "Brevard",
  "cocoa": "Brevard",
  "titusville": "Brevard",
  "fort lauderdale": "Broward",
  "hollywood": "Broward",
  "pompano beach": "Broward",
  "deerfield beach": "Broward",
  "blountstown": "Calhoun",
  "punta gorda": "Charlotte",
  "inverness": "Citrus",
  "green cove springs": "Clay",
  "naples": "Collier",
  "marco island": "Collier",
  "lake city": "Columbia",
  "arcadia": "DeSoto",
  "cross city": "Dixie",
  "jacksonville": "Duval",
  "pensacola": "Escambia",
  "bunnell": "Flagler",
  "palm coast": "Flagler",
  "apalachicola": "Franklin",
  "quincy": "Gadsden",
  "trenton": "Gilchrist",
  "moore haven": "Glades",
  "port saint joe": "Gulf",
  "jasper": "Hamilton",
  "waunchula": "Hardee",
  "labelle": "Hendry",
  "brooksville": "Hernando",
  "sebring": "Highlands",
  "tampa": "Hillsborough",
  "bonifay": "Holmes",
  "vero beach": "Indian River",
  "marianna": "Jackson",
  "monticello": "Jefferson",
  "mayo": "Lafayette",
  "tavares": "Lake",
  "leesburg": "Lake",
  "cape coral": "Lee",
  "fort myers": "Lee",
  "bonita springs": "Lee",
  "estero": "Lee",
  "tallahassee": "Leon",
  "bronson": "Levy",
  "bristol": "Liberty",
  "madison": "Madison",
  "bradenton": "Manatee",
  "ocala": "Marion",
  "stuart": "Martin",
  "miami": "Miami-Dade",
  "coral gables": "Miami-Dade",
  "hialeah": "Miami-Dade",
  "miami beach": "Miami-Dade",
  "key west": "Monroe",
  "fernandina beach": "Nassau",
  "crestview": "Okaloosa",
  "fort walton beach": "Okaloosa",
  "okeechobee": "Okeechobee",
  "orlando": "Orange",
  "kissimmee": "Osceola",
  "west palm beach": "Palm Beach",
  "boca raton": "Palm Beach",
  "boynton beach": "Palm Beach",
  "delray beach": "Palm Beach",
  "dade city": "Pasco",
  "new port richey": "Pasco",
  "saint petersburg": "Pinellas",
  "st petersburg": "Pinellas",
  "clearwater": "Pinellas",
  "lakeland": "Polk",
  "bartow": "Polk",
  "palatka": "Putnam",
  "saint augustine": "Saint Johns",
  "st augustine": "Saint Johns",
  "fort pierce": "Saint Lucie",
  "port saint lucie": "Saint Lucie",
  "port st lucie": "Saint Lucie",
  "milton": "Santa Rosa",
  "sarasota": "Sarasota",
  "sanford": "Seminole",
  "bushnell": "Sumter",
  "live oak": "Suwannee",
  "perry": "Taylor",
  "lake butler": "Union",
  "daytona beach": "Volusia",
  "ormond beach": "Volusia",
  "deland": "Volusia",
  "crawfordville": "Wakulla",
  "de funiak springs": "Walton",
  "chipley": "Washington",
};

function countyFromCity(cityRaw) {
  const city = normalizeCity(cityRaw);
  if (!city) return null;
  return COUNTY_LOOKUP[city] ?? null;
}

function pickSftpZipPath(mode) {
  return mode === "quarterly" ? QUARTERLY_ZIP_PATH : DAILY_ZIP_PATH;
}

function makeTempDir() {
  const base = path.join(os.tmpdir(), "flbusinesssearch-seo");
  if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true });
  const dir = path.join(base, `data-agent-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function extractFirstDataFile(zipPath, outDir) {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries().filter((e) => !e.isDirectory);
  if (entries.length === 0) throw new Error("ZIP contained no files");
  const preferred =
    entries.find((e) => /\.txt$/i.test(e.entryName)) ??
    entries.find((e) => /\.dat$/i.test(e.entryName)) ??
    entries[0];
  zip.extractEntryTo(preferred, outDir, false, true);
  return path.join(outDir, preferred.entryName);
}

function parseRecordLine(line) {
  const raw = String(line ?? "");
  if (raw.length < 480) {
    console.warn(`parseRecordLine: line length ${raw.length} is less than 480; skipping`);
    return null;
  }

  const document_number = safeTrim(raw.slice(0, 12));
  const name = safeTrim(raw.slice(12, 204));
  const status_flag = raw.charAt(204) || "";
  const entity_type_code = raw.slice(207, 209);
  const street_address = safeTrim(raw.slice(220, 300));
  const city = safeTrim(raw.slice(300, 332));
  const state = safeTrim(raw.slice(332, 334));
  const zip = safeTrim(raw.slice(334, 339));
  const filing_date_raw = safeTrim(raw.slice(472, 480));

  if (!document_number || !name) return null;

  let status;
  if (status_flag === "I") status = "Active";
  else if (status_flag === "A") status = "Inactive";
  else status = "Unknown";

  let entity_type;
  if (entity_type_code === "AL") entity_type = "LLC";
  else if (entity_type_code === "NP" || entity_type_code === "MN") entity_type = "Non-Profit Corporation";
  else if (entity_type_code === "MP" || entity_type_code === "P ") entity_type = "For-Profit Corporation";
  else if (entity_type_code === "PA") entity_type = "Professional Association";
  else entity_type = safeTrim(entity_type_code);

  let filing_date = null;
  if (filing_date_raw.length === 8 && /^\d{8}$/.test(filing_date_raw) && !/^0+$/.test(filing_date_raw)) {
    const mm = filing_date_raw.slice(0, 2);
    const dd = filing_date_raw.slice(2, 4);
    const yyyy = filing_date_raw.slice(4, 8);
    filing_date = `${yyyy}-${mm}-${dd}`;
  }

  const county = countyFromCity(city);
  const county_slug = county ? toCountySlug(county) : null;
  const name_norm = nameNormalized(name);
  const slug = slugFrom(name_norm, county_slug);

  return {
    document_number,
    sunbiz_document_number: document_number,
    name,
    name_normalized: name_norm || null,
    slug: slug || null,
    filing_date,
    status,
    entity_type,
    street_address,
    city,
    state,
    zip,
    county,
    county_slug,
    owner_name: null,
    registered_agent: null,
    principal_state: state,
  };
}

function passesFilters(rec) {
  if (!rec) return false;
  if (rec.status !== "Active") return false;
  if (rec.principal_state !== "FL") return false;
  const year = parseInt(rec.filing_date?.slice(0, 4) ?? "0", 10);
  if (!Number.isFinite(year) || year < 2020) return false;
  const allowed = new Set([
    "LLC",
    "Non-Profit Corporation",
    "For-Profit Corporation",
    "Professional Association",
  ]);
  if (!allowed.has(rec.entity_type)) return false;
  if (!rec.sunbiz_document_number) return false;
  if (!rec.slug) return false;
  return true;
}

async function writeAgentLog({ supabaseUrl, serviceKey, payload }) {
  const url = `${supabaseUrl}/rest/v1/agent_logs`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    console.error("agent_logs insert failed", res.status, t);
  }
}

async function triggerEnrichment(enrichmentUrl, businessIds) {
  if (!enrichmentUrl || businessIds.length === 0) return;
  try {
    const res = await fetch(enrichmentUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ business_ids: businessIds, triggered_by: "data-agent" }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.error("enrichment trigger failed", res.status, t);
    }
  } catch (e) {
    console.error("enrichment trigger error", e);
  }
}

async function upsertBatch(supabase, batch) {
  const nowIso = new Date().toISOString();
  const payload = batch.map((r) => ({
    sunbiz_document_number: r.sunbiz_document_number,
    name: r.name,
    name_normalized: r.name_normalized,
    slug: r.slug,
    filing_date: r.filing_date,
    status: r.status,
    entity_type: r.entity_type,
    county: r.county,
    county_slug: r.county_slug,
    owner_name: r.owner_name,
    registered_agent: r.registered_agent,
    updated_at: nowIso,
  }));

  const docNums = payload.map((p) => p.sunbiz_document_number).filter(Boolean);
  const { data: existingRows, error: existingErr } = await supabase
    .from("businesses")
    .select("sunbiz_document_number")
    .in("sunbiz_document_number", docNums);
  if (existingErr) throw existingErr;

  const existing = new Set((existingRows ?? []).map((x) => x.sunbiz_document_number).filter(Boolean));
  const newDocNums = docNums.filter((d) => !existing.has(d));

  const { error: upsertErr } = await supabase
    .from("businesses")
    .upsert(payload, { onConflict: "sunbiz_document_number" });
  if (upsertErr) throw upsertErr;

  let insertedIds = [];
  if (newDocNums.length > 0) {
    const { data: insertedRows, error: insErr } = await supabase
      .from("businesses")
      .select("id, sunbiz_document_number")
      .in("sunbiz_document_number", newDocNums);
    if (insErr) throw insErr;
    insertedIds = (insertedRows ?? []).map((r) => r.id).filter(Boolean);
  }

  return {
    insertedCount: newDocNums.length,
    insertedIds,
  };
}

async function main() {
  const testMode = process.argv.includes("--test");
  const startedAt = Date.now();
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const sftpHost = requireEnv("SFTP_HOST");
  const sftpUsername = requireEnv("SFTP_USERNAME");
  const sftpPassword = requireEnv("SFTP_PASSWORD");
  const enrichmentUrl = process.env.ENRICHMENT_AGENT_URL || "";
  const mode = process.env.DATA_MODE === "quarterly" ? "quarterly" : "daily";

  const supabase = createClient(supabaseUrl, serviceKey);

  let status = "success";
  let errorMessage = null;

  let totalParsed = 0;
  let totalInserted = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let testRecordsParsed = 0;
  const insertedIds = [];

  const tempDir = makeTempDir();
  const zipLocalPath = path.join(tempDir, "cordata.zip");

  try {
    const sftp = new SftpClient();
    const remoteZip = pickSftpZipPath(mode);

    try {
      await sftp.connect({
        host: sftpHost,
        username: sftpUsername,
        password: sftpPassword,
      });
      await sftp.fastGet(remoteZip, zipLocalPath);
    } finally {
      try {
        await sftp.end();
      } catch {
        // ignore
      }
    }

    const extractedFile = extractFirstDataFile(zipLocalPath, tempDir);
    const rl = readline.createInterface({
      input: fs.createReadStream(extractedFile, { encoding: "utf8" }),
      crlfDelay: Infinity,
    });

    let batch = [];
    for await (const line of rl) {
      if (testMode && totalParsed >= 100) break;
      totalParsed += 1;
      try {
        const parsed = parseRecordLine(line);
        if (testMode) {
          if (parsed) {
            console.log(JSON.stringify(parsed, null, 2));
            testRecordsParsed += 1;
          }
          continue;
        }
        if (!passesFilters(parsed)) {
          totalSkipped += 1;
          continue;
        }
        batch.push(parsed);

        if (batch.length >= BATCH_SIZE) {
          try {
            const res = await upsertBatch(supabase, batch);
            totalInserted += res.insertedCount;
            insertedIds.push(...res.insertedIds);
          } catch (e) {
            totalErrors += 1;
            console.error("batch upsert error", e);
          } finally {
            batch = [];
          }
        }
      } catch (e) {
        totalErrors += 1;
        console.error("parse/filter error", e);
      }
    }

    if (!testMode && batch.length > 0) {
      try {
        const res = await upsertBatch(supabase, batch);
        totalInserted += res.insertedCount;
        insertedIds.push(...res.insertedIds);
      } catch (e) {
        totalErrors += 1;
        console.error("final batch upsert error", e);
      }
    }

    if (testMode) {
      console.log(`TEST MODE COMPLETE — ${testRecordsParsed} records parsed, 0 inserted`);
    }

    if (totalErrors > 0 && totalInserted === 0) status = "error";
    else if (totalErrors > 0) status = "partial";

    if (insertedIds.length > 0) {
      await triggerEnrichment(enrichmentUrl, insertedIds);
    }
  } catch (e) {
    status = "error";
    errorMessage = String(e);
    console.error("data-agent fatal error", e);
  } finally {
    const runDurationMs = Date.now() - startedAt;
    await writeAgentLog({
      supabaseUrl,
      serviceKey,
      payload: {
        agent_name: "data-agent",
        run_at: new Date().toISOString(),
        records_processed: totalInserted,
        status,
        error_message: errorMessage,
        metadata: {
          total_parsed: totalParsed,
          total_inserted: totalInserted,
          total_skipped: totalSkipped,
          total_errors: totalErrors,
          run_duration_ms: runDurationMs,
          mode,
        },
      },
    });

    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }

  if (status === "error") process.exitCode = 1;
}

main().catch((e) => {
  console.error("data-agent uncaught error", e);
  process.exitCode = 1;
});

