import { Task, TaskCandidate, TaskArea, TaskUpdate, UpdateKind } from "@/types";

export function generateTaskId(): string {
  return `task-${Date.now()}`;
}

export function appendUpdate(
  updates: TaskUpdate[],
  kind: UpdateKind,
  summary: string,
  raw_input?: string
): TaskUpdate[] {
  const entry: TaskUpdate = {
    ts: new Date().toISOString(),
    kind,
    summary,
  };
  if (raw_input !== undefined) {
    entry.raw_input = raw_input;
  }
  return [...updates, entry];
}

/**
 * Merge a candidate into an existing task.
 * Rules:
 * - Never overwrite existing non-null fields
 * - Fill null fields only
 * - Merge areas arrays (deduplicated union)
 * - notes stays separate — never touched by merges
 * - Earlier due_date wins
 * - Append to updates log
 */
export function mergeTask(
  existing: Task,
  candidate: TaskCandidate,
  rawInput?: string
): Task {
  const filledFields: string[] = [];

  // Merge due_date: earlier wins
  let due_date = existing.due_date;
  if (candidate.due_date) {
    if (!existing.due_date) {
      due_date = candidate.due_date;
      filledFields.push("due_date");
    } else if (candidate.due_date < existing.due_date) {
      due_date = candidate.due_date;
      filledFields.push("due_date (earlier date)");
    }
  }

  // Fill null fields only
  const duration = existing.duration ?? candidate.duration;
  if (!existing.duration && candidate.duration) filledFields.push("duration");

  const current_steps = existing.current_steps ?? candidate.current_steps;
  if (!existing.current_steps && candidate.current_steps) filledFields.push("current_steps");

  const next_steps = existing.next_steps ?? candidate.next_steps;
  if (!existing.next_steps && candidate.next_steps) filledFields.push("next_steps");

  const primary_area = existing.primary_area ?? candidate.primary_area;
  if (!existing.primary_area && candidate.primary_area) filledFields.push("primary_area");

  // Merge areas (deduplicated union)
  const existingAreas = existing.areas ?? [];
  const candidateAreas = candidate.areas ?? [];
  const mergedAreas = Array.from(
    new Set([...existingAreas, ...candidateAreas])
  ) as TaskArea[];
  const areasChanged = mergedAreas.length > existingAreas.length;
  if (areasChanged) filledFields.push("areas");

  const summary =
    filledFields.length > 0
      ? `Merged fields: ${filledFields.join(", ")}`
      : "Duplicate detected — no new fields to merge";

  const updates = appendUpdate(existing.updates, "merge", summary, rawInput);

  return {
    ...existing,
    due_date,
    duration,
    current_steps,
    next_steps,
    primary_area,
    areas: mergedAreas.length > 0 ? mergedAreas : null,
    updates,
  };
}
