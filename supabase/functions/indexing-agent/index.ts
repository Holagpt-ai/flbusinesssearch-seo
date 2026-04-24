// @ts-expect-error - Deno/Edge import via esm.sh (not resolvable by Node tsc)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAgentRun } from "../_shared/base.ts";

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getGoogleAccessToken(): Promise<string> {
  const email = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL")!;
  const privateKey = Deno.env.get("GOOGLE_PRIVATE_KEY")!.replace(/\\n/g, "\n");
  const keyId = Deno.env.get("GOOGLE_PRIVATE_KEY_ID")!;

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT", kid: keyId };
  const payload = {
    iss: email,
    sub: email,
    scope: "https://www.googleapis.com/auth/indexing",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  function base64url(str: string): string {
    return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  }

  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  // Import the private key
  const keyData = privateKey
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const binaryKey = Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signingBytes = new TextEncoder().encode(signingInput);
  const signatureBytes = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, signingBytes);
  const signatureB64 = base64url(
    String.fromCharCode(...new Uint8Array(signatureBytes)),
  );

  const jwt = `${signingInput}.${signatureB64}`;

  // Exchange JWT for access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Token exchange failed: ${err}`);
  }

  const tokenData = await tokenRes.json() as { access_token: string };
  return tokenData.access_token;
}

async function submitUrlToGoogle(url: string, accessToken: string): Promise<boolean> {
  const res = await fetch("https://indexing.googleapis.com/v3/urlNotifications:publish", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url, type: "URL_UPDATED" }),
  });
  return res.ok;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const runAt = new Date().toISOString();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const BATCH_SIZE = 100;
  let submitted = 0;
  let errors = 0;

  try {
    // Get enriched businesses not yet indexed
    const { data: businesses, error } = await supabase
      .from("businesses")
      .select("id, slug")
      .eq("enrichment_status", "enriched")
      .is("indexed_at", null)
      .not("slug", "is", null)
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (error) throw error;
    if (!businesses || businesses.length === 0) {
      await logAgentRun(supabase, {
        agent_name: "indexing-agent",
        run_at: runAt,
        records_processed: 0,
        status: "skipped",
        error_message: null,
        metadata: { reason: "no_pending_urls" },
      });
      return jsonResponse({ ok: true, submitted: 0, message: "No URLs to index" });
    }

    // Get Google access token
    const accessToken = await getGoogleAccessToken();

    // Submit each URL
    const indexedIds: string[] = [];
    for (const biz of businesses) {
      const url = `https://flbusinesssearch.com/business/${biz.slug}`;
      const ok = await submitUrlToGoogle(url, accessToken);
      if (ok) {
        indexedIds.push(biz.id);
        submitted++;
      } else {
        errors++;
      }
    }

    // Mark submitted rows as indexed
    if (indexedIds.length > 0) {
      const { error: updateError } = await supabase
        .from("businesses")
        .update({ indexed_at: new Date().toISOString() })
        .in("id", indexedIds);
      if (updateError) throw updateError;
    }

    await logAgentRun(supabase, {
      agent_name: "indexing-agent",
      run_at: runAt,
      records_processed: submitted,
      status: errors > 0 && submitted === 0 ? "error" : errors > 0 ? "partial" : "success",
      error_message: null,
      metadata: { submitted, errors, total: businesses.length },
    });

    return jsonResponse({ ok: true, submitted, errors });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logAgentRun(supabase, {
      agent_name: "indexing-agent",
      run_at: runAt,
      records_processed: 0,
      status: "error",
      error_message: msg,
      metadata: { submitted, errors },
    }).catch(() => {});
    return jsonResponse({ ok: false, error: msg }, 500);
  }
});
