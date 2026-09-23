-- Each ephemeral editor action is executed by one browser session only.
ALTER TABLE public.studio_editor_action ADD COLUMN IF NOT EXISTS claimed_by uuid;
