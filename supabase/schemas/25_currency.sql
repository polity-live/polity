-- 25_currency.sql: canonical current definitions; historical upgrades are not replayed.

CREATE TABLE public.currency_exchange_rate_cache (
    base_currency text NOT NULL,
    quote_currency text NOT NULL,
    requested_date text NOT NULL,
    rate_date date NOT NULL,
    rate numeric(24,12) NOT NULL,
    source text DEFAULT 'frankfurter'::text NOT NULL,
    fetched_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT currency_exchange_rate_cache_base_currency_check CHECK ((base_currency ~ '^[A-Z]{3}$'::text)),
    CONSTRAINT currency_exchange_rate_cache_quote_currency_check CHECK ((quote_currency ~ '^[A-Z]{3}$'::text)),
    CONSTRAINT currency_exchange_rate_cache_rate_check CHECK ((rate > (0)::numeric)),
    CONSTRAINT currency_exchange_rate_cache_pkey PRIMARY KEY (base_currency, quote_currency, requested_date)
);

ALTER TABLE public.currency_exchange_rate_cache ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_currency_exchange_rate_cache_fetched ON public.currency_exchange_rate_cache USING btree (fetched_at);

CREATE POLICY service_role_all ON public.currency_exchange_rate_cache TO service_role USING (true) WITH CHECK (true);
