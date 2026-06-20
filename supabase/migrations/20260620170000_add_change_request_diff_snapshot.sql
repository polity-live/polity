ALTER TABLE public.change_request
  ADD COLUMN IF NOT EXISTS change_type TEXT,
  ADD COLUMN IF NOT EXISTS original_text TEXT,
  ADD COLUMN IF NOT EXISTS new_text TEXT,
  ADD COLUMN IF NOT EXISTS original_properties JSONB,
  ADD COLUMN IF NOT EXISTS new_properties JSONB;
