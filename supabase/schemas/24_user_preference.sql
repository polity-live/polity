-- =============================================================================
-- 24_user_preference.sql — User preferences (form style, etc.)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.user_preference (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public."user" (id) ON DELETE CASCADE UNIQUE,
  create_form_style TEXT NOT NULL DEFAULT 'carousel',
  theme TEXT NOT NULL DEFAULT 'system',
  language TEXT NOT NULL DEFAULT 'en',
  display_currency TEXT NOT NULL DEFAULT 'EUR' CHECK (display_currency ~ '^[A-Z]{3}$'),
  navigation_view TEXT NOT NULL DEFAULT 'asButtonList',
  group_network_layouts JSONB NOT NULL DEFAULT '{}'::jsonb,
  decision_terminal_dashboard JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_preference_user ON public.user_preference (user_id);

ALTER TABLE public.user_preference
  ADD COLUMN IF NOT EXISTS group_network_layouts JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.user_preference
  ADD COLUMN IF NOT EXISTS decision_terminal_dashboard JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.user_preference
  ADD COLUMN IF NOT EXISTS display_currency TEXT NOT NULL DEFAULT 'EUR';

ALTER TABLE public.user_preference
  DROP CONSTRAINT IF EXISTS user_preference_display_currency_check;
ALTER TABLE public.user_preference
  ADD CONSTRAINT user_preference_display_currency_check
  CHECK (display_currency ~ '^[A-Z]{3}$');

ALTER TABLE public.user_preference ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.user_preference FOR ALL TO service_role USING (true);
