-- @covers schema 12_payment.sql
-- @covers schema 23_appearance_theme.sql
-- @covers schema 24_user_preference.sql
-- @covers schema 25_currency.sql
-- @covers schema 26_voting_password.sql
-- @covers schema 28_ai.sql
-- @covers schema 29_pql_filter.sql
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(24);

CREATE OR REPLACE FUNCTION pg_temp.capture_sqlstate(command TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE command;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END;
$$;

INSERT INTO public."user" (id, handle)
VALUES
  ('f1000000-1000-0000-0000-000000000001', 'account-user-1'),
  ('f1000000-1000-0000-0000-000000000002', 'account-user-2');

INSERT INTO public."group" (id, name, owner_id)
VALUES ('f2000000-1000-0000-0000-000000000001', 'Account group', 'f1000000-1000-0000-0000-000000000001');

INSERT INTO public.payment (
  id, amount, currency, label, payer_user_id, receiver_user_id
)
VALUES ('f3000000-1000-0000-0000-000000000001', 10.25, 'EUR', 'Membership', 'f1000000-1000-0000-0000-000000000001', 'f1000000-1000-0000-0000-000000000002');

INSERT INTO public.stripe_customer (
  id, user_id, stripe_customer_id, email
)
VALUES ('f3100000-1000-0000-0000-000000000001', 'f1000000-1000-0000-0000-000000000001', 'cus_contract_1', 'account@test.invalid');

INSERT INTO public.stripe_subscription (
  id, customer_id, stripe_subscription_id, status
)
VALUES ('f3200000-1000-0000-0000-000000000001', 'f3100000-1000-0000-0000-000000000001', 'sub_contract_1', 'active');

INSERT INTO public.stripe_payment (
  id, customer_id, stripe_invoice_id, status
)
VALUES ('f3300000-1000-0000-0000-000000000001', 'f3100000-1000-0000-0000-000000000001', 'in_contract_1', 'paid');

INSERT INTO public.appearance_theme (
  id, slug, name, kind, group_id, created_by_id
)
VALUES ('f4000000-1000-0000-0000-000000000001', 'contract-theme', 'Contract theme', 'group', 'f2000000-1000-0000-0000-000000000001', 'f1000000-1000-0000-0000-000000000001');

INSERT INTO public.appearance_theme_revision (
  id, theme_id, version, status, light_palette, dark_palette, fonts, created_by_id
)
VALUES ('f4100000-1000-0000-0000-000000000001', 'f4000000-1000-0000-0000-000000000001', 1, 'draft', '{}', '{}', '{}', 'f1000000-1000-0000-0000-000000000001');

UPDATE public.appearance_theme
SET current_revision_id = 'f4100000-1000-0000-0000-000000000001'
WHERE id = 'f4000000-1000-0000-0000-000000000001';

INSERT INTO public.user_preference (
  id, user_id, language, display_currency, appearance_theme_id
)
VALUES ('f5000000-1000-0000-0000-000000000001', 'f1000000-1000-0000-0000-000000000001', 'de', 'EUR', 'f4000000-1000-0000-0000-000000000001');

INSERT INTO public.currency_exchange_rate_cache (
  base_currency, quote_currency, requested_date, rate_date, rate
)
VALUES ('EUR', 'USD', 'latest', '2026-07-28', 1.15);

INSERT INTO public.voting_password (id, user_id, password_hash)
VALUES ('f6000000-1000-0000-0000-000000000001', 'f1000000-1000-0000-0000-000000000001', 'hashed-pin');

INSERT INTO public.ai_skill (
  id, user_id, slug, name, system_prompt
)
VALUES ('f7000000-1000-0000-0000-000000000001', 'f1000000-1000-0000-0000-000000000001', 'contract-skill', 'Contract skill', 'System prompt');

INSERT INTO public.ai_tool (id, user_id, tool_name)
VALUES ('f7100000-1000-0000-0000-000000000001', 'f1000000-1000-0000-0000-000000000001', 'contract_tool');

INSERT INTO public.ai_provider_credential (
  id, user_id, provider, encrypted_key, key_hint
)
VALUES ('f7200000-1000-0000-0000-000000000001', 'f1000000-1000-0000-0000-000000000001', 'openai', 'encrypted', '...test');

INSERT INTO public.pql_filter (
  id, user_id, group_id, storage_key, label, query, is_active
)
VALUES ('f7300000-1000-0000-0000-000000000001', 'f1000000-1000-0000-0000-000000000001', 'f2000000-1000-0000-0000-000000000001', 'timeline', 'Active filter', 'type = statement', true);

SELECT ok(
  EXISTS (SELECT 1 FROM public.stripe_payment WHERE id = 'f3300000-1000-0000-0000-000000000001')
  AND EXISTS (SELECT 1 FROM public.appearance_theme_revision WHERE id = 'f4100000-1000-0000-0000-000000000001')
  AND EXISTS (SELECT 1 FROM public.currency_exchange_rate_cache WHERE base_currency = 'EUR')
  AND EXISTS (SELECT 1 FROM public.ai_provider_credential WHERE id = 'f7200000-1000-0000-0000-000000000001')
  AND EXISTS (SELECT 1 FROM public.pql_filter WHERE id = 'f7300000-1000-0000-0000-000000000001'),
  'payments, appearance, preferences, currency, voting password, AI, and filters are accepted'
);

SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.payment SET currency = 'eur' WHERE id = 'f3000000-1000-0000-0000-000000000001'$sql$), '23514', 'payment currency uses ISO uppercase format');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.stripe_customer (user_id, stripe_customer_id) VALUES ('f1000000-1000-0000-0000-000000000001', 'cus_contract_2')$sql$), '23505', 'Stripe customers are unique per user');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.stripe_customer (user_id, stripe_customer_id) VALUES ('f1000000-1000-0000-0000-000000000002', 'cus_contract_1')$sql$), '23505', 'Stripe customer IDs are unique');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.stripe_subscription (customer_id, stripe_subscription_id) VALUES ('f3100000-1000-0000-0000-000000000001', 'sub_contract_1')$sql$), '23505', 'Stripe subscription IDs are unique');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.stripe_payment (customer_id, stripe_invoice_id) VALUES ('f3100000-1000-0000-0000-000000000001', 'in_contract_1')$sql$), '23505', 'Stripe invoice IDs are unique');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.appearance_theme SET kind = 'invalid' WHERE id = 'f4000000-1000-0000-0000-000000000001'$sql$), '23514', 'appearance theme kind is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.appearance_theme SET kind = 'builtin' WHERE id = 'f4000000-1000-0000-0000-000000000001'$sql$), '23514', 'group themes require a group scope');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.appearance_theme_revision SET version = 0 WHERE id = 'f4100000-1000-0000-0000-000000000001'$sql$), '23514', 'theme revision versions are positive');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.appearance_theme_revision SET status = 'invalid' WHERE id = 'f4100000-1000-0000-0000-000000000001'$sql$), '23514', 'theme revision status is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.appearance_theme (slug, name, kind, group_id) VALUES ('contract-theme', 'Duplicate', 'group', 'f2000000-1000-0000-0000-000000000001')$sql$), '23505', 'theme slugs are unique per scope');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.appearance_theme_revision (theme_id, version, status, light_palette, dark_palette, fonts) VALUES ('f4000000-1000-0000-0000-000000000001', 1, 'published', '{}', '{}', '{}')$sql$), '23505', 'theme versions are unique');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.appearance_theme_revision (theme_id, version, status, light_palette, dark_palette, fonts) VALUES ('f4000000-1000-0000-0000-000000000001', 2, 'draft', '{}', '{}', '{}')$sql$), '23505', 'a theme has at most one draft');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.user_preference SET language = 'fr' WHERE id = 'f5000000-1000-0000-0000-000000000001'$sql$), '23514', 'preference language is constrained');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.user_preference SET display_currency = 'eur' WHERE id = 'f5000000-1000-0000-0000-000000000001'$sql$), '23514', 'display currency uses ISO uppercase format');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.user_preference (user_id) VALUES ('f1000000-1000-0000-0000-000000000001')$sql$), '23505', 'preferences are unique per user');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.currency_exchange_rate_cache SET base_currency = 'eur' WHERE base_currency = 'EUR'$sql$), '23514', 'exchange-rate base currency uses ISO uppercase format');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.currency_exchange_rate_cache SET quote_currency = 'usd' WHERE base_currency = 'EUR'$sql$), '23514', 'exchange-rate quote currency uses ISO uppercase format');
SELECT is(pg_temp.capture_sqlstate($sql$UPDATE public.currency_exchange_rate_cache SET rate = 0 WHERE base_currency = 'EUR'$sql$), '23514', 'exchange rates are positive');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.voting_password (user_id, password_hash) VALUES ('f1000000-1000-0000-0000-000000000001', 'duplicate')$sql$), '23505', 'voting passwords are unique per user');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.ai_skill (user_id, slug, name, system_prompt) VALUES ('f1000000-1000-0000-0000-000000000001', 'contract-skill', 'Duplicate', 'Prompt')$sql$), '23505', 'AI skill slugs are unique per user');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.ai_tool (user_id, tool_name) VALUES ('f1000000-1000-0000-0000-000000000001', 'contract_tool')$sql$), '23505', 'AI tools are unique per user and name');
SELECT is(pg_temp.capture_sqlstate($sql$INSERT INTO public.ai_provider_credential (user_id, provider, encrypted_key) VALUES ('f1000000-1000-0000-0000-000000000001', 'openai', 'duplicate')$sql$), '23505', 'AI provider credentials are unique per user and provider');

DELETE FROM public."user"
WHERE id = 'f1000000-1000-0000-0000-000000000001';

SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.stripe_customer WHERE id = 'f3100000-1000-0000-0000-000000000001')
  AND NOT EXISTS (SELECT 1 FROM public.user_preference WHERE id = 'f5000000-1000-0000-0000-000000000001')
  AND NOT EXISTS (SELECT 1 FROM public.voting_password WHERE id = 'f6000000-1000-0000-0000-000000000001')
  AND NOT EXISTS (SELECT 1 FROM public.ai_skill WHERE id = 'f7000000-1000-0000-0000-000000000001')
  AND NOT EXISTS (SELECT 1 FROM public.pql_filter WHERE id = 'f7300000-1000-0000-0000-000000000001')
  AND (SELECT payer_user_id IS NULL FROM public.payment WHERE id = 'f3000000-1000-0000-0000-000000000001'),
  'user deletion cascades private configuration while preserving payment history'
);

SELECT * FROM finish();

ROLLBACK;
