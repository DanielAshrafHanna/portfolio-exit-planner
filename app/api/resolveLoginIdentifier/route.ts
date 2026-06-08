import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const requestSchema = z.object({
  identifier: z.string().trim().min(1).max(80)
});

type PortfolioNameRow = {
  user_id: string;
  display_name: string | null;
};

function escapeIlikePattern(value: string) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

export async function POST(request: Request) {
  const body = await safeJson(request);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid login identifier" }, { status: 400 });
  }

  const identifier = parsed.data.identifier.trim();
  if (identifier.includes("@")) {
    return NextResponse.json({ email: identifier.toLowerCase(), resolvedBy: "email" });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Display name login is not configured. Please sign in with email." }, { status: 503 });
  }

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  const pattern = escapeIlikePattern(identifier);
  const { data, error } = await adminClient
    .from("user_portfolios")
    .select("user_id, display_name")
    .ilike("display_name", pattern)
    .limit(3);

  if (error) {
    return NextResponse.json({ error: "Display name lookup failed. Please sign in with email." }, { status: 500 });
  }

  const matches = ((data || []) as PortfolioNameRow[]).filter((row) => (row.display_name || "").trim().toLowerCase() === identifier.toLowerCase());
  if (!matches.length) {
    return NextResponse.json({ error: "No account found for that display name. Please check the name or sign in with email." }, { status: 404 });
  }
  if (matches.length > 1) {
    return NextResponse.json({ error: "More than one account uses that display name. Please sign in with email." }, { status: 409 });
  }

  const { data: userData, error: userError } = await adminClient.auth.admin.getUserById(matches[0].user_id);
  const email = userData?.user?.email;
  if (userError || !email) {
    return NextResponse.json({ error: "Display name account could not be resolved. Please sign in with email." }, { status: 404 });
  }

  return NextResponse.json({ email, resolvedBy: "displayName" });
}

async function safeJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}
