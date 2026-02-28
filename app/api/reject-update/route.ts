import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateTaskId, appendUpdate } from "@/lib/task-utils";
import { cleanTitle, normalizeTitle } from "@/lib/normalize";
import { Task, PendingAction } from "@/types";

export async function POST(request: NextRequest) {
  const supabase = createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  // Fetch and verify the pending action belongs to this user
  const { data: pendingData, error: fetchError } = await supabase
    .from("pending_actions")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !pendingData) {
    return NextResponse.json({ error: "Pending action not found" }, { status: 404 });
  }

  const pending = pendingData as PendingAction;
  const candidate = pending.candidate;

  // Create new task from the candidate (user said "no, this is different")
  const taskId = generateTaskId();
  const newTask: Omit<Task, "created_at" | "updated_at"> = {
    id: taskId,
    user_id: user.id,
    title: cleanTitle(candidate.title_display),
    title_display: candidate.title_display,
    title_normalized: normalizeTitle(candidate.title_display),
    due_date: candidate.due_date,
    duration: candidate.duration,
    current_steps: candidate.current_steps,
    status: candidate.status,
    next_steps: candidate.next_steps,
    notes: candidate.notes,
    updates: appendUpdate([], "created", "Task created (rejected duplicate match)"),
    areas: candidate.areas?.length ? candidate.areas : null,
    primary_area: candidate.primary_area,
  };

  const { error: insertError } = await supabase.from("tasks").insert(newTask);
  if (insertError) {
    console.error("[reject-update] insert error:", insertError);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }

  // Delete the pending action
  await supabase.from("pending_actions").delete().eq("id", id).eq("user_id", user.id);

  const { data: savedTask } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .single();

  return NextResponse.json({ task: savedTask });
}
