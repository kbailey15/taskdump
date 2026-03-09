-- TaskDump Supabase Schema
-- Run this in the Supabase SQL Editor

-- ============================================================
-- tasks table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tasks (
  id              text PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           text NOT NULL,
  title_display   text NOT NULL,
  title_normalized text NOT NULL,
  due_date        date,
  duration        text,
  current_steps   text,
  status          text NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'in_progress', 'waiting', 'completed')),
  next_steps      text,
  notes           text,
  updates         jsonb NOT NULL DEFAULT '[]',
  areas           text[],
  primary_area    text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks: select own" ON public.tasks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "tasks: insert own" ON public.tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tasks: update own" ON public.tasks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "tasks: delete own" ON public.tasks
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- pending_actions table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pending_actions (
  id                text PRIMARY KEY,
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  candidate         jsonb NOT NULL,
  existing_task_id  text NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  score             float NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.pending_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pending_actions: select own" ON public.pending_actions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "pending_actions: insert own" ON public.pending_actions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "pending_actions: update own" ON public.pending_actions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "pending_actions: delete own" ON public.pending_actions
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- user_settings table
-- ============================================================
CREATE TABLE IF NOT EXISTS user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  custom_statuses jsonb NOT NULL DEFAULT '[
    {"id":"open","label":"Open"},
    {"id":"in_progress","label":"In progress"},
    {"id":"waiting","label":"Waiting"},
    {"id":"completed","label":"Done"}
  ]'::jsonb,
  custom_areas jsonb NOT NULL DEFAULT '[
    {"id":"health","label":"Health"},
    {"id":"life_admin","label":"Life admin"},
    {"id":"career","label":"Career"},
    {"id":"relationships","label":"Relationships"},
    {"id":"fun","label":"Fun"}
  ]'::jsonb,
  updated_at timestamptz DEFAULT now()
);

-- daily_structure: { wake_up: { time, days }, sleep: { time, days } }
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS daily_structure jsonb;

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_settings: select own" ON user_settings
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_settings: insert own" ON user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_settings: update own" ON user_settings
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- user_profile table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_profile (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data       jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_profile: select own" ON public.user_profile
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_profile: insert own" ON public.user_profile
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_profile: update own" ON public.user_profile
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- daily_plans table
-- ============================================================
-- Each item in the blocks jsonb array has this shape:
-- {
--   id: string,
--   start_time: string (HH:MM 24hr),
--   end_time: string (HH:MM 24hr),
--   title: string,
--   type: "deep_work" | "admin" | "life_admin" | "meeting" | "routine" | "break" | "exercise" | "meal",
--   task_id: string | null,
--   why: string,
--   guidance: string,
--   done_metric: string,
--   status: "pending" | "completed"
-- }
CREATE TABLE IF NOT EXISTS public.daily_plans (
  id            text PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date          date NOT NULL,
  blocks        jsonb NOT NULL DEFAULT '[]'::jsonb,
  comments      text,
  generated_at  timestamptz DEFAULT now(),
  version       integer NOT NULL DEFAULT 1,
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (user_id, date)
);

-- edit_log: append-only array of manual block edits.
-- Each entry: { ts, block_id, block_title, changes[{field,old,new}], scheduled_start, plan_date, was_late }
-- was_late=true means the edit happened after the block's start time (day deviated from plan).
-- Consumed by nightly reflection to surface patterns and suggest schedule adjustments.
ALTER TABLE public.daily_plans
  ADD COLUMN IF NOT EXISTS edit_log jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TRIGGER daily_plans_updated_at
  BEFORE UPDATE ON public.daily_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.daily_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_plans: select own" ON public.daily_plans
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "daily_plans: insert own" ON public.daily_plans
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "daily_plans: update own" ON public.daily_plans
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "daily_plans: delete own" ON public.daily_plans
  FOR DELETE USING (auth.uid() = user_id);
