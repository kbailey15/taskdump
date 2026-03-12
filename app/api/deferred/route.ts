import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PlanBlock } from "@/types";

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// POST — reschedule a deferred block
// Body: { plan_id, block_id, date?, time? }
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { plan_id: string; block_id: string; date?: string; time?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { plan_id, block_id, date, time } = body;
  if (!plan_id || !block_id) {
    return NextResponse.json({ error: "Missing plan_id or block_id" }, { status: 400 });
  }

  // Fetch original plan
  const { data: originalPlan, error: planError } = await supabase
    .from("daily_plans")
    .select("*")
    .eq("id", plan_id)
    .eq("user_id", user.id)
    .single();

  if (planError || !originalPlan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  const block: PlanBlock | undefined = (originalPlan.blocks as PlanBlock[]).find(
    (b) => b.id === block_id
  );
  if (!block) {
    return NextResponse.json({ error: "Block not found in plan" }, { status: 404 });
  }

  // Remove block from original plan
  const trimmedBlocks = (originalPlan.blocks as PlanBlock[]).filter((b) => b.id !== block_id);
  await supabase
    .from("daily_plans")
    .upsert(
      {
        ...originalPlan,
        blocks: trimmedBlocks,
        version: (originalPlan.version ?? 0) + 1,
      },
      { onConflict: "user_id,date" }
    );

  const now = new Date().toISOString();

  // Case 1: date + time — add back to that day's plan at specified time
  if (date && time) {
    const { data: targetPlan } = await supabase
      .from("daily_plans")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", date)
      .single();

    if (targetPlan) {
      const durationMinutes =
        timeToMinutes(block.end_time) - timeToMinutes(block.start_time);
      const newStart = time;
      const newEnd = minutesToTime(timeToMinutes(time) + Math.max(durationMinutes, 30));

      const rescheduledBlock: PlanBlock = {
        ...block,
        start_time: newStart,
        end_time: newEnd,
        status: "pending",
        rescheduled_from: { start_time: block.start_time, end_time: block.end_time },
      };

      const newBlocks = [...(targetPlan.blocks as PlanBlock[]), rescheduledBlock].sort(
        (a, b) => a.start_time.localeCompare(b.start_time)
      );

      await supabase.from("daily_plans").upsert(
        {
          ...targetPlan,
          blocks: newBlocks,
          version: (targetPlan.version ?? 0) + 1,
        },
        { onConflict: "user_id,date" }
      );

      return NextResponse.json({ ok: true, action: "added_to_plan" });
    }
    // Target plan doesn't exist — fall through to task creation with date
  }

  // Case 2: date only — create task with due_date, status open
  // Case 3: neither — create task with no date, KBLOS will schedule
  const taskId = `task-${Date.now()}`;
  const titleDisplay = block.title;
  const titleNormalized = block.title.toLowerCase().replace(/\s+/g, " ").trim();

  const newTask = {
    id: taskId,
    user_id: user.id,
    title: titleNormalized,
    title_display: titleDisplay,
    title_normalized: titleNormalized,
    due_date: date ?? null,
    duration: null,
    current_steps: null,
    status: "open",
    next_steps: null,
    notes: null,
    updates: [
      {
        ts: now,
        kind: "created",
        summary: `Rescheduled from deferred block on ${originalPlan.date}`,
      },
    ],
    areas: null,
    primary_area: null,
    created_at: now,
    updated_at: now,
  };

  const { error: taskError } = await supabase.from("tasks").insert(newTask);
  if (taskError) {
    console.error("[deferred] task insert error:", taskError);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    action: date ? "added_as_task_with_date" : "added_as_task_no_date",
  });
}

// DELETE — permanently remove a block from its plan
// Body: { plan_id, block_id }
export async function DELETE(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { plan_id: string; block_id: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { plan_id, block_id } = body;
  if (!plan_id || !block_id) {
    return NextResponse.json({ error: "Missing plan_id or block_id" }, { status: 400 });
  }

  const { data: plan, error: planError } = await supabase
    .from("daily_plans")
    .select("*")
    .eq("id", plan_id)
    .eq("user_id", user.id)
    .single();

  if (planError || !plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  const updatedBlocks = (plan.blocks as PlanBlock[]).filter((b) => b.id !== block_id);

  const { error: upsertError } = await supabase
    .from("daily_plans")
    .upsert(
      {
        ...plan,
        blocks: updatedBlocks,
        version: (plan.version ?? 0) + 1,
      },
      { onConflict: "user_id,date" }
    );

  if (upsertError) {
    console.error("[deferred] delete block error:", upsertError);
    return NextResponse.json({ error: "Failed to delete block" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
