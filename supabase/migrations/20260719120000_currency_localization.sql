ALTER TABLE public.payment
  ALTER COLUMN amount TYPE NUMERIC(16,4),
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'EUR';

UPDATE public.payment SET currency = 'EUR' WHERE currency IS NULL;

ALTER TABLE public.payment DROP CONSTRAINT IF EXISTS payment_currency_check;
ALTER TABLE public.payment
  ADD CONSTRAINT payment_currency_check CHECK (currency ~ '^[A-Z]{3}$');

ALTER TABLE public.user_preference
  ADD COLUMN IF NOT EXISTS display_currency TEXT NOT NULL DEFAULT 'EUR';

ALTER TABLE public.user_preference
  DROP CONSTRAINT IF EXISTS user_preference_display_currency_check;
ALTER TABLE public.user_preference
  ADD CONSTRAINT user_preference_display_currency_check
  CHECK (display_currency ~ '^[A-Z]{3}$');

CREATE TABLE IF NOT EXISTS public.currency_exchange_rate_cache (
  base_currency TEXT NOT NULL CHECK (base_currency ~ '^[A-Z]{3}$'),
  quote_currency TEXT NOT NULL CHECK (quote_currency ~ '^[A-Z]{3}$'),
  requested_date TEXT NOT NULL,
  rate_date DATE NOT NULL,
  rate NUMERIC(24,12) NOT NULL CHECK (rate > 0),
  source TEXT NOT NULL DEFAULT 'frankfurter',
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (base_currency, quote_currency, requested_date)
);

CREATE INDEX IF NOT EXISTS idx_currency_exchange_rate_cache_fetched
  ON public.currency_exchange_rate_cache (fetched_at);

ALTER TABLE public.currency_exchange_rate_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON public.currency_exchange_rate_cache;
CREATE POLICY "service_role_all" ON public.currency_exchange_rate_cache
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT ALL PRIVILEGES ON public.currency_exchange_rate_cache TO service_role;
