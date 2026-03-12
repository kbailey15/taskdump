export type TaskStatus = "open" | "in_progress" | "waiting" | "completed";
export type FilterItem = { id: string; label: string; hidden?: boolean };
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Sun, 6=Sat

export interface DailyStructureItem {
  time: string; // "HH:MM" 24-hour
  days: DayOfWeek[];
}

export interface DailyStructure {
  wake_up: DailyStructureItem | null;
  sleep: DailyStructureItem | null;
}

export type UserSettings = {
  custom_statuses: FilterItem[];
  custom_areas: FilterItem[];
  daily_structure: DailyStructure | null;
};
export type TaskArea = "health" | "life_admin" | "career" | "relationships" | "fun";
export type Confidence = "high" | "medium" | "low";
export type UpdateKind = "merge" | "field_update" | "created";

export interface TaskUpdate {
  ts: string;
  kind: UpdateKind;
  summary: string;
  raw_input?: string;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  title_display: string;
  title_normalized: string;
  due_date: string | null;
  duration: string | null;
  current_steps: string | null;
  status: TaskStatus;
  next_steps: string | null;
  notes: string | null;
  updates: TaskUpdate[];
  areas: TaskArea[] | null;
  primary_area: TaskArea | null;
  created_at: string;
  updated_at: string;
}

export interface PendingAction {
  id: string;
  user_id: string;
  candidate: TaskCandidate;
  existing_task_id: string;
  score: number;
  created_at: string;
}

export interface TaskCandidate {
  title_display: string;
  title?: string;
  title_normalized?: string;
  due_date: string | null;
  duration: string | null;
  current_steps: string | null;
  status: TaskStatus;
  next_steps: string | null;
  notes: string | null;
  areas: TaskArea[];
  primary_area: TaskArea | null;
  confidence: Confidence;
}

export interface ParseResult {
  created: Task[];
  updated: Task[];
  pending: PendingActionResult[];
  unconfirmed: TaskCandidate[];
  clarifications: string[];
  error?: string;
}

export interface PendingActionResult {
  pending_action_id: string;
  candidate: TaskCandidate;
  existing_task: Task;
  score: number;
}

export type PlanBlockType =
  | "deep_work"
  | "admin"
  | "life_admin"
  | "meeting"
  | "routine"
  | "break"
  | "exercise"
  | "meal"
  | "commitment"
  | "personal_growth";

export type PlanBlockStatus = "pending" | "completed" | "skipped" | "deferred" | "dropped";

export interface PlanBlock {
  id: string;
  start_time: string; // HH:MM 24hr
  end_time: string;   // HH:MM 24hr
  title: string;
  type: PlanBlockType;
  task_id: string | null;
  why: string;
  guidance: string;
  done_metric: string;
  status: PlanBlockStatus;
  guidance_checks?: number[]; // indices of checked guidance step lines
  is_recurring?: boolean; // true for blocks that repeat daily (routine, exercise, meal, etc.)
  rescheduled_from?: { start_time: string; end_time: string }; // original time if moved
}

// Recorded whenever a block is manually edited.
// was_late=true means the edit happened after the block's scheduled start time,
// suggesting the day didn't go as planned. Referenced during nightly reflection.
export interface PlanEditEntry {
  ts: string;          // ISO timestamp of the edit
  block_id: string;
  block_title: string; // title at time of edit (for readability in logs)
  changes: { field: string; old: string; new: string }[];
  scheduled_start: string; // HH:MM — original start time of the block
  plan_date: string;   // YYYY-MM-DD
  was_late: boolean;   // true if edited after scheduled start time
  action?: "edit" | "skip" | "move"; // what triggered this log entry
  conflict_note?: string; // set when a recurring block is moved to a conflicting slot
}

export interface DailyPlan {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  blocks: PlanBlock[];
  comments: string | null;
  generated_at: string;
  version: number;
  updated_at: string;
  // Internal log of manual edits — used to detect off-schedule days
  // and surface patterns during nightly reflection.
  edit_log?: PlanEditEntry[];
}
