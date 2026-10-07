# OpenAI sign-in and personal AI access

Polity separates its Supabase login identity from the credentials used for AI
requests. An OpenAI identity never supplies an API key or authorizes ChatGPT plan
usage by itself.

## Available now

Save personal OpenAI, Anthropic or OpenRouter keys in the existing AI settings.
Keys remain encrypted with `AI_ENCRYPTION_SECRET` in the server-only credential
table. No secret is added to Zero, conversation state, model descriptors or the
client catalog.

The chat model picker names the credential source: Polity free (`app`), personal
API key (`byok`), or the reserved ChatGPT plan source (`chatgpt`). The provider,
source and model ID identify a selection. The server validates that selection
against the requesting user's catalog. Selecting a free application model does
not use an existing personal OpenRouter key. Selecting a missing personal key
does not fall back to the application key.

AI chat, Street Design project chat and Studio project chat use this same
selection. Nested Studio design generation receives the actor and selection from
the server-side chat context, never from model-generated tool arguments. The
existing native design compiler, permission checks, source audience checks and
proposal acceptance remain in place. Theme-only changes make no generation call.
Legacy Studio callers without a selection still use confirmed zero-price models.

New chat runs persist `source` in the existing model/configuration JSON. No
database migration is required. Old requests without `source` retain their
previous provider resolution behavior. Usage and credential failures stop the
request; changing the model or payer requires the user's explicit selection.

## Activate ChatGPT identity sign-in after approval

The feature defaults to off (`VITE_CHATGPT_LOGIN_ENABLED=false`). Before enabling:

1. Obtain Polity's own registered OpenAI OAuth client. The Supabase Dashboard's
   ChatGPT login and Supabase plugin integration do not register Polity's client.
2. Configure a confidential custom OIDC provider in Supabase Auth with identifier
   `custom:openai`, issuer `https://auth.openai.com`, scopes `openid profile email`,
   `pkce_enabled=true`, and `skip_nonce_check=false`. Keep the client secret in
   Supabase's provider configuration; never use a `VITE_` variable for it.
3. Copy the callback URL shown by Supabase and register that exact URL with
   OpenAI. For a hosted project this is normally
   `https://<project-ref>.supabase.co/auth/v1/callback`. A local Supabase stack uses
   its own callback; it must be registered separately. Do not substitute the
   Polity frontend callback as OpenAI's redirect URI.
4. Allow Polity's exact `/auth/callback?chatgpt=login` and
   `/auth/callback?chatgpt=link` return URLs in Supabase for each environment.
   Production uses `https://www.polity.live`; development uses
   `http://localhost:3000`. Keep clients, secrets and configuration separate.
5. Enable Supabase manual identity linking, then enable
   `VITE_CHATGPT_LOGIN_ENABLED=true` and rebuild the frontend.

The login button uses Supabase's OAuth flow. Existing verified-email account
linking remains managed by Supabase. Logged-in users can explicitly link a
different-email ChatGPT identity from AI settings using `linkIdentity`. The
callback requires a successful code exchange, a verified `custom:openai`
identity, and, for linking, the original Polity user ID. Cancellation and failed
exchanges cannot succeed through an old session. Linking returns to AI settings.

The settings card reports login linkage and AI authorization separately.

## ChatGPT plan usage remains unavailable

`chatgpt` is a reserved credential source, rejected by the resolver even when
identity login is enabled. No OAuth access/refresh token is collected or stored
for inference. Hosted plan usage needs its own OpenAI approval and partner
contract before adding a separate server-only token store, account model catalog,
refresh, revocation and inference adapter. The public OSS loopback registration
flow is not a production web-app registration mechanism. Login activation alone
must not expose plan-backed models.

References: [OpenAI sign-in](https://developers.openai.com/siwc/quickstart),
[hosted usage eligibility](https://developers.openai.com/siwc/token-sharing-open-source),
[Supabase OIDC](https://supabase.com/docs/guides/auth/custom-oauth-providers),
[identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking).
