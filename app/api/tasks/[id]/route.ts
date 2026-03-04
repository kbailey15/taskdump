import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TaskStatus, TaskArea } from "@/types";
import { cleanTitle, normalizeTitle } from "@/lib/normalize";
import { appendUpdate } from "@/lib/task-utils";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    status?: TaskStatus;
    title_display?: string;
    due_date?: string | null;
    duration?: string | null;
    current_steps?: string | null;
    next_steps?: string | null;
    notes?: string | null;
    areas?: TaskArea[];
    primary_area?: TaskArea | null;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Fetch existing task to append update log
  const { data: existing, error: fetchError } = await supabase
    .from("tasks")
    .select("updates")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const updates = appendUpdate(existing.updates ?? [], "field_update", "Task edited");

  const patch: Record<string, unknown> = { updates };

  if (body.status !== undefined) patch.status = body.status;
  if (body.due_date !== undefined) patch.due_date = body.due_date;
  if (body.duration !== undefined) patch.duration = body.duration;
  if (body.current_steps !== undefined) patch.current_steps = body.current_steps;
  if (body.next_steps !== undefined) patch.next_steps = body.next_steps;
  if (body.notes !== undefined) patch.notes = body.notes;
  if (body.areas !== undefined) patch.areas = body.areas;
  if (body.primary_area !== undefined) patch.primary_area = body.primary_area;

  if (body.title_display !== undefined) {
    patch.title_display = body.title_display;
    patch.title = cleanTitle(body.title_display);
    patch.title_normalized = normalizeTitle(body.title_display);
  }

  const { error: updateError } = await supabase
    .from("tasks")
    .update(patch)
    .eq("id", params.id)
    .eq("user_id", user.id);

  if (updateError) {
    console.error("[tasks/[id]] update error:", updateError);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }

  const { data: updated } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", params.id)
    .single();

  return NextResponse.json({ task: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error: deleteError } = await supabase
    .from("tasks")
    .delete()
    .eq("id", params.id)
    .eq("user_id", user.id);

  if (deleteError) {
    console.error("[tasks/[id]] delete error:", deleteError);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
