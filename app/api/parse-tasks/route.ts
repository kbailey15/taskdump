import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseTasks } from "@/lib/claude";
import { findDuplicate } from "@/lib/duplicate-detection";
import { generateTaskId, mergeTask, appendUpdate } from "@/lib/task-utils";
import { cleanTitle, normalizeTitle } from "@/lib/normalize";
import { Task, TaskCandidate, ParseResult, PendingActionResult } from "@/types";

export async function POST(request: NextRequest) {
  const supabase = createClient();

  // Auth — server always derives user_id from session
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { text?: string; candidate?: TaskCandidate };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Case 1: direct candidate confirmation (low-confidence "yes, save it" flow)
  if (body.candidate) {
    const candidate = body.candidate;
    const title = cleanTitle(candidate.title_display);
    const title_normalized = normalizeTitle(candidate.title_display);

    const id = generateTaskId();
    const newTask: Omit<Task, "created_at" | "updated_at"> = {
      id,
      user_id: user.id,
      title,
      title_display: candidate.title_display,
      title_normalized,
      due_date: candidate.due_date,
      duration: candidate.duration,
      current_steps: candidate.current_steps,
      status: candidate.status,
      next_steps: candidate.next_steps,
      notes: candidate.notes,
      updates: appendUpdate([], "created", `Task created from confirmed candidate`),
      areas: candidate.areas?.length ? candidate.areas : null,
      primary_area: candidate.primary_area,
    };

    const { error: insertError } = await supabase.from("tasks").insert(newTask);
    if (insertError) {
      console.error("[parse-tasks] insert error:", insertError);
      return NextResponse.json({ error: "Failed to save task" }, { status: 500 });
    }

    const { data: saved } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", id)
      .single();

    const result: ParseResult = {
      created: saved ? [saved as Task] : [],
      updated: [],
      pending: [],
      unconfirmed: [],
      clarifications: [],
    };
    return NextResponse.json(result);
  }

  // Case 2: freeform text parse
  if (!body.text?.trim()) {
    return NextResponse.json({ error: "No text provided" }, { status: 400 });
  }

  const { candidates, clarifications, error: parseError } = await parseTasks(body.text);

  if (parseError) {
    return NextResponse.json({ error: parseError }, { status: 422 });
  }

  // Fetch existing tasks for duplicate detection
  const { data: existingTasksData } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", user.id);

  const existingTasks: Task[] = existingTasksData ?? [];

  const created: Task[] = [];
  const updated: Task[] = [];
  const pending: PendingActionResult[] = [];
  const unconfirmed: TaskCandidate[] = [];

  for (const candidate of candidates) {
    // Low-confidence Claude candidates go to "unconfirmed" for user confirmation
    if (candidate.confidence === "low") {
      unconfirmed.push(candidate);
      continue;
    }

    const { confidence: dupConfidence, score, matchedTask } = findDuplicate(
      candidate,
      existingTasks
    );

    if (dupConfidence === "high" && matchedTask) {
      // Auto-merge
      const merged = mergeTask(matchedTask, candidate, body.text);
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
        .eq("id", matchedTask.id)
        .eq("user_id", user.id);

      if (updateError) {
        console.error("[parse-tasks] update error:", updateError);
        continue;
      }

      const { data: updatedTask } = await supabase
        .from("tasks")
        .select("*")
        .eq("id", matchedTask.id)
        .single();

      if (updatedTask) {
        updated.push(updatedTask as Task);
        // Update local cache so subsequent candidates see the updated task
        const idx = existingTasks.findIndex((t) => t.id === matchedTask.id);
        if (idx !== -1) existingTasks[idx] = updatedTask as Task;
      }
    } else if (dupConfidence === "medium" && matchedTask) {
      // Store pending_action for user confirmation
      const pendingId = `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const { error: pendingError } = await supabase.from("pending_actions").insert({
        id: pendingId,
        user_id: user.id,
        candidate,
        existing_task_id: matchedTask.id,
        score,
      });

      if (!pendingError) {
        pending.push({
          pending_action_id: pendingId,
          candidate,
          existing_task: matchedTask,
          score,
        });
      }
    } else {
      // Create new task
      const id = generateTaskId();
      const newTask: Omit<Task, "created_at" | "updated_at"> = {
        id,
        user_id: user.id,
        title: candidate.title ?? cleanTitle(candidate.title_display),
        title_display: candidate.title_display,
        title_normalized: candidate.title_normalized ?? normalizeTitle(candidate.title_display),
        due_date: candidate.due_date,
        duration: candidate.duration,
        current_steps: candidate.current_steps,
        status: candidate.status,
        next_steps: candidate.next_steps,
        notes: candidate.notes,
        updates: appendUpdate([], "created", "Task created"),
        areas: candidate.areas?.length ? candidate.areas : null,
        primary_area: candidate.primary_area,
      };

      const { error: insertError } = await supabase.from("tasks").insert(newTask);
      if (insertError) {
        console.error("[parse-tasks] insert error:", insertError);
        continue;
      }

      const { data: saved } = await supabase
        .from("tasks")
        .select("*")
        .eq("id", id)
        .single();

      if (saved) {
        created.push(saved as Task);
        existingTasks.push(saved as Task);
      }
    }
  }

  const result: ParseResult = { created, updated, pending, unconfirmed, clarifications };
  return NextResponse.json(result);
}
