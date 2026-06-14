ALTER TABLE public.user_preference
  ADD COLUMN IF NOT EXISTS decision_terminal_dashboard JSONB NOT NULL DEFAULT '{}'::jsonb;
