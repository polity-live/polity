-- Additive: existing navigation and create-form preferences are not changed.
ALTER TABLE public.user_preference
  ADD COLUMN workspace_preferences JSONB NOT NULL
  DEFAULT '{"favorites":[],"display":{}}'::jsonb
  CHECK (jsonb_typeof(workspace_preferences) = 'object');
