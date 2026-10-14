-- 20_5_agenda_item_change_request.sql: canonical current definitions; historical upgrades are not replayed.

CREATE TABLE public.agenda_item_change_request (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agenda_item_id uuid NOT NULL,
    change_request_id uuid,
    vote_id uuid,
    order_index integer DEFAULT 0 NOT NULL,
    step_kind text DEFAULT 'change_request'::text NOT NULL,
    process_branch_id uuid,
    is_closing_vote boolean DEFAULT false NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    blocked_reason text,
    result_status text,
    obsolete_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT agenda_item_change_request_step_kind_check CHECK ((step_kind = ANY (ARRAY['change_request'::text, 'closing'::text, 'merge_variant'::text]))),
    CONSTRAINT agenda_item_change_request_pkey PRIMARY KEY (id)
);

ALTER TABLE public.agenda_item_change_request ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_aicr_agenda_item ON public.agenda_item_change_request USING btree (agenda_item_id);

CREATE INDEX idx_aicr_change_request ON public.agenda_item_change_request USING btree (change_request_id);

CREATE INDEX idx_aicr_process_branch ON public.agenda_item_change_request USING btree (process_branch_id);

CREATE INDEX idx_aicr_step_kind ON public.agenda_item_change_request USING btree (agenda_item_id, step_kind);

CREATE UNIQUE INDEX idx_aicr_unique ON public.agenda_item_change_request USING btree (agenda_item_id, change_request_id) WHERE (change_request_id IS NOT NULL);

CREATE INDEX idx_aicr_vote ON public.agenda_item_change_request USING btree (vote_id);

CREATE POLICY service_role_all ON public.agenda_item_change_request TO service_role USING (true);
