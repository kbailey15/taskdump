import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PlanBlock } from "@/types";

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const date = request.nextUrl.searchParams.get("date");
  if (!date) {
    return NextResponse.json({ error: "Missing date param" }, { status: 400 });
  }

  const { data: plan } = await supabase
    .from("daily_plans")
    .select("*")
    .eq("user_id", user.id)
    .eq("date", date)
    .single();

  return NextResponse.json({ plan: plan ?? null });
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

  let body: { date: string; blocks: PlanBlock[]; comments?: string; edit_log?: unknown[]; review?: object | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { date, blocks, comments, edit_log, review } = body;
  if (!date || !Array.isArray(blocks)) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Fetch existing plan to get current version for increment
  const { data: existing } = await supabase
    .from("daily_plans")
    .select("version")
    .eq("user_id", user.id)
    .eq("date", date)
    .single();

  const record = {
    id: `${user.id}_${date}`,
    user_id: user.id,
    date,
    blocks,
    comments: comments ?? null,
    edit_log: edit_log ?? [],
    version: (existing?.version ?? 0) + 1,
    ...(review !== undefined ? { review: review ?? null } : {}),
  };

  const { data: saved, error: upsertError } = await supabase
    .from("daily_plans")
    .upsert(record, { onConflict: "user_id,date" })
    .select()
    .single();

  if (upsertError) {
    console.error("[plans] upsert error:", upsertError);
    return NextResponse.json({ error: "Failed to save plan" }, { status: 500 });
  }

  return NextResponse.json({ plan: saved });
}

export async function DELETE(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const date = request.nextUrl.searchParams.get("date");
  if (!date) {
    return NextResponse.json({ error: "Missing date param" }, { status: 400 });
  }

  const { error: deleteError } = await supabase
    .from("daily_plans")
    .delete()
    .eq("user_id", user.id)
    .eq("date", date);

  if (deleteError) {
    console.error("[plans] delete error:", deleteError);
    return NextResponse.json({ error: "Failed to delete plan" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
