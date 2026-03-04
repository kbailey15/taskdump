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

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_settings: select own" ON user_settings
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_settings: insert own" ON user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_settings: update own" ON user_settings
  FOR UPDATE USING (auth.uid() = user_id);
