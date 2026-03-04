import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { FilterItem } from "@/types";

const DEFAULT_STATUSES: FilterItem[] = [
  { id: "open", label: "Open" },
  { id: "in_progress", label: "In progress" },
  { id: "waiting", label: "Waiting" },
  { id: "completed", label: "Done" },
];

const DEFAULT_AREAS: FilterItem[] = [
  { id: "health", label: "Health" },
  { id: "life_admin", label: "Life admin" },
  { id: "career", label: "Career" },
  { id: "relationships", label: "Relationships" },
  { id: "fun", label: "Fun" },
];

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
    .from("user_settings")
    .select("custom_statuses, custom_areas")
    .eq("user_id", user.id)
    .single();

  if (existing) {
    return NextResponse.json(existing);
  }

  // Seed defaults
  const defaults = {
    user_id: user.id,
    custom_statuses: DEFAULT_STATUSES,
    custom_areas: DEFAULT_AREAS,
  };

  const { error: insertError } = await supabase
    .from("user_settings")
    .insert(defaults);

  if (insertError) {
    console.error("[settings] insert error:", insertError);
  }

  return NextResponse.json({
    custom_statuses: DEFAULT_STATUSES,
    custom_areas: DEFAULT_AREAS,
  });
}

export async function PUT(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { custom_statuses?: FilterItem[]; custom_areas?: FilterItem[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const patch: Record<string, unknown> = { user_id: user.id };
  if (body.custom_statuses !== undefined) patch.custom_statuses = body.custom_statuses;
  if (body.custom_areas !== undefined) patch.custom_areas = body.custom_areas;

  const { error: upsertError } = await supabase
    .from("user_settings")
    .upsert(patch, { onConflict: "user_id" });

  if (upsertError) {
    console.error("[settings] upsert error:", upsertError);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
