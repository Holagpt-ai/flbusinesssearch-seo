import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET(request: Request) {
  try {
    const q = new URL(request.url).searchParams.get("q");

    if (q === null || q.trim().length < 2) {
      return NextResponse.json([]);
    }

    const normalizedQ = q
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .trim();

    const supabase = createServerClient();

    const { data, error } = await supabase
      .from("businesses")
      .select("name, slug, county, status")
      .ilike("name_normalized", `%${normalizedQ}%`)
      .order("filing_date", { ascending: false })
      .limit(8);

    if (error || data === null) {
      return NextResponse.json([]);
    }

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        "Access-Control-Allow-Origin": "https://flbusinesssearch.com",
      },
    });
  } catch {
    return NextResponse.json([]);
  }
}
