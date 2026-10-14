-- 24_user_preference.sql: canonical current definitions; historical upgrades are not replayed.

CREATE TABLE public.user_preference (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    create_form_style text DEFAULT 'carousel'::text NOT NULL,
    theme text DEFAULT 'system'::text NOT NULL,
    language text DEFAULT 'en'::text NOT NULL,
    display_currency text DEFAULT 'EUR'::text NOT NULL,
    navigation_view text DEFAULT 'asButtonList'::text NOT NULL,
    workspace_preferences jsonb DEFAULT '{"display": {}, "favorites": []}'::jsonb NOT NULL,
    group_network_layouts jsonb DEFAULT '{}'::jsonb NOT NULL,
    decision_terminal_dashboard jsonb DEFAULT '{}'::jsonb NOT NULL,
    app_tutorial_completed_at timestamp with time zone,
    appearance_theme_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_preference_display_currency_check CHECK ((display_currency ~ '^[A-Z]{3}$'::text)),
    CONSTRAINT user_preference_language_check CHECK ((language = ANY (ARRAY['de'::text, 'en'::text]))),
    CONSTRAINT user_preference_workspace_preferences_check CHECK ((jsonb_typeof(workspace_preferences) = 'object'::text)),
    CONSTRAINT user_preference_pkey PRIMARY KEY (id),
    CONSTRAINT user_preference_user_id_key UNIQUE (user_id)
);

ALTER TABLE public.user_preference ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_user_preference_appearance_theme ON public.user_preference USING btree (appearance_theme_id);

CREATE INDEX idx_user_preference_user ON public.user_preference USING btree (user_id);

CREATE POLICY service_role_all ON public.user_preference TO service_role USING (true);
