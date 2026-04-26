/* eslint-disable no-console */

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const readline = require("readline");

const SftpClient = require("ssh2-sftp-client");
const AdmZip = require("adm-zip");
const { createClient } = require("@supabase/supabase-js");

const DAILY_FILE_DIR = "/Public/doc/cor";
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

function pickSftpPath(mode) {
  if (mode === "quarterly") return QUARTERLY_ZIP_PATH;
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  return `${DAILY_FILE_DIR}/${yyyy}${mm}${dd}c.txt`;
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
  if (raw.length < 1440) return null;

  const document_number = safeTrim(raw.slice(0, 12));
  const name = safeTrim(raw.slice(12, 204));
  const status_flag = raw.charAt(204) || "";
  const entity_type_code = safeTrim(raw.slice(207, 209));
  const street_address = safeTrim(raw.slice(220, 262));
  const city = safeTrim(raw.slice(304, 332));
  const state = safeTrim(raw.slice(332, 334));
  const zip = safeTrim(raw.slice(334, 344));
  const mailing_street = safeTrim(raw.slice(346, 388));
  const mailing_city = safeTrim(raw.slice(430, 458));
  const mailing_state = safeTrim(raw.slice(458, 460));
  const mailing_zip = safeTrim(raw.slice(460, 470));
  const filing_date_raw = safeTrim(raw.slice(472, 480));

  if (!document_number || !name) return null;

  const fei_ein = safeTrim(raw.slice(480, 494));
  const state_of_formation = safeTrim(raw.slice(495, 497));
  const last_event_date = safeTrim(raw.slice(497, 505));
  const agent_name = safeTrim(raw.slice(544, 586));
  const agent_street = safeTrim(raw.slice(587, 629));
  const agent_city = safeTrim(raw.slice(629, 657));
  const agent_state = safeTrim(raw.slice(657, 659));
  const agent_zip = safeTrim(raw.slice(659, 668));

  const officers = [];
  for (let i = 0; i < 6; i++) {
    const offset = 668 + (i * 128);
    const off_name = safeTrim(raw.slice(offset + 5, offset + 47));
    if (off_name) {
      officers.push({
        title: safeTrim(raw.slice(offset, offset + 4)) || null,
        name: off_name,
        street: safeTrim(raw.slice(offset + 47, offset + 89)) || null,
        city: safeTrim(raw.slice(offset + 89, offset + 117)) || null,
        state: safeTrim(raw.slice(offset + 117, offset + 119)) || null,
        zip: safeTrim(raw.slice(offset + 119, offset + 128)) || null,
      });
    }
  }

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
    mailing_street: mailing_street || null,
    mailing_city: mailing_city || null,
    mailing_state: mailing_state || null,
    mailing_zip: mailing_zip || null,
    fei_ein: fei_ein || null,
    state_of_formation: state_of_formation || null,
    last_event_date: last_event_date || null,
    registered_agent_name: agent_name || null,
    registered_agent_street: agent_street || null,
    registered_agent_city: agent_city || null,
    registered_agent_state: agent_state || null,
    registered_agent_zip: agent_zip || null,
    officers: officers.length > 0 ? officers : null,
    county,
    county_slug,
    principal_state: state,
  };
}

function passesFilters(rec) {
  if (!rec) return false;
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
    mailing_street: r.mailing_street,
    mailing_city: r.mailing_city,
    mailing_state: r.mailing_state,
    mailing_zip: r.mailing_zip,
    fei_ein: r.fei_ein,
    state_of_formation: r.state_of_formation,
    last_event_date: r.last_event_date,
    registered_agent_name: r.registered_agent_name,
    registered_agent_street: r.registered_agent_street,
    registered_agent_city: r.registered_agent_city,
    registered_agent_state: r.registered_agent_state,
    registered_agent_zip: r.registered_agent_zip,
    officers: r.officers,
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

  // Deduplicate payload by slug to avoid unique constraint violations
  const seen = new Set();
  const dedupedPayload = payload.filter((r) => {
    if (!r.slug || seen.has(r.slug)) return false;
    seen.add(r.slug);
    return true;
  });

  const { error: upsertErr } = await supabase
    .from("businesses")
    .upsert(dedupedPayload, { onConflict: "sunbiz_document_number", ignoreDuplicates: false });
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
  const localMode = process.argv.includes('--local');
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
    let rl;
    if (localMode) {
      const localFilePath = '/root/cordata-extract/cordata0.txt';
      console.log('[local mode] Reading from ' + localFilePath);
      rl = readline.createInterface({
        input: fs.createReadStream(localFilePath, { encoding: 'utf8' }),
        crlfDelay: Infinity,
      });
    } else {
      const sftp = new SftpClient();
      const remoteFile = pickSftpPath(mode);

      try {
        await sftp.connect({
          host: sftpHost,
          username: sftpUsername,
          password: sftpPassword,
        });
        if (mode === "quarterly") {
          await sftp.fastGet(remoteFile, zipLocalPath);
        } else {
          const dailyLocalPath = path.join(tempDir, "daily.txt");
          await sftp.fastGet(remoteFile, dailyLocalPath);
        }
      } finally {
        try {
          await sftp.end();
        } catch {
          // ignore
        }
      }

      if (mode === "quarterly") {
        const extractedFile = extractFirstDataFile(zipLocalPath, tempDir);
        rl = readline.createInterface({
          input: fs.createReadStream(extractedFile, { encoding: "utf8" }),
          crlfDelay: Infinity,
        });
      } else {
        const dailyLocalPath = path.join(tempDir, "daily.txt");
        rl = readline.createInterface({
          input: fs.createReadStream(dailyLocalPath, { encoding: "utf8" }),
          crlfDelay: Infinity,
        });
      }
    }

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

