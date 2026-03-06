import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: existing } = await supabase
    .from("user_profile")
    .select("data")
    .eq("user_id", user.id)
    .single();

  return NextResponse.json(existing?.data ?? {});
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let incoming: Record<string, unknown>;
  try {
    incoming = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Load existing data and merge at the section level so other sections are preserved
  const { data: existing } = await supabase
    .from("user_profile")
    .select("data")
    .eq("user_id", user.id)
    .single();

  const merged = { ...(existing?.data ?? {}), ...incoming };

  const { error: upsertError } = await supabase
    .from("user_profile")
    .upsert({ user_id: user.id, data: merged }, { onConflict: "user_id" });

  if (upsertError) {
    console.error("[profile] upsert error:", upsertError);
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
