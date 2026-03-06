-- Add daily_structure column to user_settings
-- Stores wake-up and sleep time preferences per day of week
-- Shape: { wake_up: { time: "HH:MM", days: number[] } | null, sleep: ... | null }
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS daily_structure jsonb;
