-- =============================================================================
-- 25_currency.sql — Server-only Frankfurter exchange-rate cache
-- =============================================================================

CREATE TABLE public.currency_exchange_rate_cache (
  base_currency TEXT NOT NULL CHECK (base_currency ~ '^[A-Z]{3}$'),
  quote_currency TEXT NOT NULL CHECK (quote_currency ~ '^[A-Z]{3}$'),
  requested_date TEXT NOT NULL,
  rate_date DATE NOT NULL,
  rate NUMERIC(24,12) NOT NULL CHECK (rate > 0),
  source TEXT NOT NULL DEFAULT 'frankfurter',
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (base_currency, quote_currency, requested_date)
);

CREATE INDEX idx_currency_exchange_rate_cache_fetched
  ON public.currency_exchange_rate_cache (fetched_at);

ALTER TABLE public.currency_exchange_rate_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.currency_exchange_rate_cache
  FOR ALL TO service_role USING (true) WITH CHECK (true);
