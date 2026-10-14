-- 12_payment.sql: canonical current definitions; historical upgrades are not replayed.

CREATE TABLE public.payment (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    amount numeric(16,4),
    currency text DEFAULT 'EUR'::text NOT NULL,
    label text,
    type text,
    payer_user_id uuid,
    payer_group_id uuid,
    receiver_user_id uuid,
    receiver_group_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tutorial_run_id uuid,
    CONSTRAINT payment_currency_check CHECK ((currency ~ '^[A-Z]{3}$'::text)),
    CONSTRAINT payment_pkey PRIMARY KEY (id)
);

CREATE TABLE public.stripe_customer (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    stripe_customer_id text NOT NULL,
    email text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT stripe_customer_pkey PRIMARY KEY (id),
    CONSTRAINT stripe_customer_stripe_customer_id_key UNIQUE (stripe_customer_id),
    CONSTRAINT stripe_customer_user_id_key UNIQUE (user_id)
);

CREATE TABLE public.stripe_payment (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    stripe_invoice_id text NOT NULL,
    stripe_customer_id text,
    stripe_subscription_id text,
    amount integer,
    currency text,
    status text,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT stripe_payment_pkey PRIMARY KEY (id),
    CONSTRAINT stripe_payment_stripe_invoice_id_key UNIQUE (stripe_invoice_id)
);

CREATE TABLE public.stripe_subscription (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    stripe_subscription_id text NOT NULL,
    stripe_customer_id text,
    status text,
    current_period_start timestamp with time zone,
    current_period_end timestamp with time zone,
    cancel_at_period_end boolean,
    amount integer,
    currency text,
    interval_period text,
    canceled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT stripe_subscription_pkey PRIMARY KEY (id),
    CONSTRAINT stripe_subscription_stripe_subscription_id_key UNIQUE (stripe_subscription_id)
);

ALTER TABLE public.payment ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.stripe_customer ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.stripe_payment ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.stripe_subscription ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_payment_payer_user ON public.payment USING btree (payer_user_id);

CREATE INDEX idx_payment_receiver_user ON public.payment USING btree (receiver_user_id);

CREATE INDEX idx_stripe_payment_customer ON public.stripe_payment USING btree (customer_id);

CREATE INDEX idx_stripe_subscription_customer ON public.stripe_subscription USING btree (customer_id);

CREATE INDEX payment_tutorial_run_id_idx ON public.payment USING btree (tutorial_run_id);

CREATE POLICY service_role_all ON public.payment TO service_role USING (true);

CREATE POLICY service_role_all ON public.stripe_customer TO service_role USING (true);

CREATE POLICY service_role_all ON public.stripe_payment TO service_role USING (true);

CREATE POLICY service_role_all ON public.stripe_subscription TO service_role USING (true);
