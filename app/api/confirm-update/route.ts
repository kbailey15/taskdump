import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { mergeTask } from "@/lib/task-utils";
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

  // Fetch the existing task
  const { data: existingData, error: taskError } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", pending.existing_task_id)
    .eq("user_id", user.id)
    .single();

  if (taskError || !existingData) {
    return NextResponse.json({ error: "Existing task not found" }, { status: 404 });
  }

  const existing = existingData as Task;
  const merged = mergeTask(existing, pending.candidate);

  const { error: updateError } = await supabase
    .from("tasks")
    .update({
      due_date: merged.due_date,
      duration: merged.duration,
      current_steps: merged.current_steps,
      next_steps: merged.next_steps,
      primary_area: merged.primary_area,
      areas: merged.areas,
      updates: merged.updates,
    })
    .eq("id", existing.id)
    .eq("user_id", user.id);

  if (updateError) {
    console.error("[confirm-update] update error:", updateError);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }

  // Delete the pending action
  await supabase.from("pending_actions").delete().eq("id", id).eq("user_id", user.id);

  const { data: updatedTask } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", existing.id)
    .single();

  return NextResponse.json({ task: updatedTask });
}
