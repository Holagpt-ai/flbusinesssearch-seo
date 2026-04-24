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

const INDEXNOW_KEY = "935576cd2b714ce3aa6b9a4e8d040a96";
const SITE_HOST = "flbusinesssearch.com";
const BATCH_SIZE = 100;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function submitToIndexNow(urls: string[]): Promise<{ submitted: number; errors: number }> {
  const res = await fetch("https://api.indexnow.org/IndexNow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: SITE_HOST,
      key: INDEXNOW_KEY,
      keyLocation: `https://${SITE_HOST}/${INDEXNOW_KEY}.txt`,
      urlList: urls,
    }),
  });
  if (res.ok || res.status === 202) {
    return { submitted: urls.length, errors: 0 };
  }
  const text = await res.text();
  console.error(`IndexNow error ${res.status}: ${text}`);
  return { submitted: 0, errors: urls.length };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const runAt = new Date().toISOString();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  let submitted = 0;
  let errors = 0;

  try {
    const { data: businesses, error } = await supabase
      .from("businesses")
      .select("id, slug")
      .eq("enrichment_status", "complete")
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

    const urls = businesses.map((biz: { slug: string }) => `https://${SITE_HOST}/business/${biz.slug}`);
    const result = await submitToIndexNow(urls);
    submitted = result.submitted;
    errors = result.errors;

    if (submitted > 0) {
      const ids = businesses.map((b: { id: string }) => b.id);
      const { error: updateError } = await supabase
        .from("businesses")
        .update({ indexed_at: new Date().toISOString() })
        .in("id", ids);
      if (updateError) throw updateError;
    }

    await logAgentRun(supabase, {
      agent_name: "indexing-agent",
      run_at: runAt,
      records_processed: submitted,
      status: errors > 0 && submitted === 0 ? "error" : errors > 0 ? "partial" : "success",
      error_message: null,
      metadata: { submitted, errors, total: businesses.length, protocol: "indexnow" },
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
