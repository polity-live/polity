# 🏛️ Polity - Democracy Reimagined

> **Empowering communities, organizations, and governments with collaborative decision-making tools for the digital age.**

[![Open Source](https://img.shields.io/badge/Open%20Source-%E2%9D%A4%EF%B8%8F-green)](https://github.com/polity-live/polity)
[![Early Alpha](https://img.shields.io/badge/Status-Early%20Alpha-orange)](#)

---

## Prerequisites

- **Node.js 24.18.0** (recommended via [nvm](https://github.com/nvm-sh/nvm))
- **Corepack** with **pnpm 10.34.5**
- **Docker Desktop** (for local Supabase and Zero development)
- **Supabase CLI** (provided by the local dependency through `pnpm exec supabase`)

---

## Running the Project

### Environment Modes

Use `.env.example` as the source of truth and copy its values into the mode-specific file you are running. Vinxi/Vite loads these files automatically by mode:

| File                     | Used for                                               | Notes                                     |
| ------------------------ | ------------------------------------------------------ | ----------------------------------------- |
| `.env.development.local` | `pnpm run dev`, local Supabase, local Zero Cache       | Local URLs and development credentials    |
| `.env.production.local`  | `pnpm run build`, `pnpm run start` production previews | Cloud service URLs and production secrets |
| `.env`                   | All modes                                              | Keep empty or shared non-sensitive values |

### External APIs and Credentials

#### Core platform

| Service        | Used for                                     | Environment variables                                                                                           | Required |
| -------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------- |
| **Supabase**   | Postgres, Auth, Storage, server-side jobs    | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Yes      |
| **Zero Cache** | Realtime sync and custom query/mutate bridge | `VITE_ZERO_CACHE_URL`, `ZERO_UPSTREAM_DB`, `ZERO_CVR_DB`, `ZERO_CHANGE_DB`, `ZERO_ADMIN_PASSWORD`               | Yes      |

#### AI

| Service                | Used for                                                                 | Environment variables                        | Required |
| ---------------------- | ------------------------------------------------------------------------ | -------------------------------------------- | -------- |
| **OpenRouter**         | Shared app-level free models and optional per-user BYOK OpenRouter usage | `OPENROUTER_API_KEY`, `AI_ENCRYPTION_SECRET` | Optional |
| **OpenAI / Anthropic** | Per-user BYOK assistant providers                                        | `AI_ENCRYPTION_SECRET`                       | Optional |

`OPENROUTER_API_KEY` enables shared free OpenRouter models for all users. User-provided OpenRouter, OpenAI, and Anthropic keys are stored encrypted; keep `AI_ENCRYPTION_SECRET` long, random, and stable across app instances that need to decrypt existing keys.

#### Payments

| Service    | Used for                                                              | Environment variables                                                                                                                                                                      | Required              |
| ---------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------- |
| **Stripe** | Checkout, billing portal, subscription status, cancellation, webhooks | `STRIPE_MODE`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_RUNNING`, `STRIPE_PRICE_DEVELOPMENT`, `STRIPE_PRODUCT_CUSTOM`, `STRIPE_PORTAL_CONFIGURATION_ID`, `VITE_APP_URL` | Required for payments |

Stripe IDs and secrets are server-only. The browser sends only the plan name (`running`,
`development`, or `custom`) and an optional custom amount. `STRIPE_MODE=test` accepts only test
keys and test resources; `STRIPE_MODE=live` accepts only live keys and live resources.

##### Stripe development workflow

1. Configure `.env.development.local` with test prices, a test custom-amount product, a test
   customer-portal configuration, and `VITE_APP_URL=http://localhost:3000`.
2. Start the app with `pnpm run dev`.
3. In a second terminal, run `pnpm run stripe:listen`.
4. Copy the Stripe CLI's `whsec_...` value into `STRIPE_WEBHOOK_SECRET` and restart the dev server
   whenever it changes.
5. Complete checkouts with Stripe test cards, then inspect Stripe CLI delivery and the
   `stripe_customer`, `stripe_subscription`, and `stripe_payment` mirrors in Supabase.

The checkout redirect repair remains available when the CLI listener is not running. Changes made
in the customer portal are reconciled after the browser returns to the app.

##### Stripe production setup

- Create separate test and live customer-portal configurations. Enable invoice history, payment
  methods, customer data, and cancellation at period end; keep portal plan switching disabled.
- Create the live webhook endpoint at
  `https://www.polity.live/api/stripe/webhook` for:
  `checkout.session.completed`, `customer.subscription.created`,
  `customer.subscription.updated`, `customer.subscription.deleted`,
  `invoice.payment_succeeded`, and `invoice.payment_failed`.
- Set Vercel Production to `STRIPE_MODE=live`, use only `sk_live_...` and live resource IDs, and
  store the endpoint signing secret as `STRIPE_WEBHOOK_SECRET`.
- Do not expose live Stripe secrets to Preview deployments. Use test resources there or disable
  payments.

#### Maps and location

| Service                      | Used for                                        | Environment variables                         | Required                    |
| ---------------------------- | ----------------------------------------------- | --------------------------------------------- | --------------------------- |
| **Geoapify**                 | Address autocomplete and reverse geocoding      | `GEOAPIFY_API_KEY` or `VITE_GEOAPIFY_API_KEY` | Required for address lookup |
| **Overpass / OpenStreetMap** | Street-scene snapshots for City Design features | None                                          | No project API key required |

#### Open data

| Service        | Used for                                                     | Environment variables                    | Required                    |
| -------------- | ------------------------------------------------------------ | ---------------------------------------- | --------------------------- |
| **Eurostat**   | Dataset catalogue, metadata, async import, chart projections | `ZERO_UPSTREAM_DB` for persisted imports | No project API key required |
| **GovData.de** | CKAN catalogue search and public CSV snapshot imports        | None                                     | No project API key required |

#### Notifications

| Service      | Used for                                                   | Environment variables                                                                                                            | Required                        |
| ------------ | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| **Web Push** | Browser push subscriptions and durable background delivery | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL`, `VITE_VAPID_PUBLIC_KEY`, `PUSH_DELIVERY_SECRET`, `PUSH_DELIVERY_ENABLED` | Required for push notifications |

### Local development mode

- App: `pnpm run dev`
- Supabase: local CLI stack via `pnpm exec supabase start`
- Zero: local zero-cache via `pnpm run zero:dev`
- Env source: `.env.development.local`

### Production mode

- Build: `pnpm run build`
- Preview built app locally: `pnpm run start`
- Supabase: cloud project
- Zero: deployed zero-cache URL
- Env source: `.env.production.local` locally, or platform env vars on Vercel/Fly.io
- Fly.io Zero deployments also set `ZERO_QUERY_URL` and `ZERO_MUTATE_URL` to the deployed app's `/api/query` and `/api/mutate` handlers.

### 1. Install dependencies

```bash
corepack enable
corepack prepare pnpm@10.34.5 --activate
pnpm install --frozen-lockfile
```

### 2. Start Supabase (local)

```bash
pnpm exec supabase start
```

This boots up a local Supabase stack (Postgres, Auth, Studio, Inbucket, etc.) via Docker.

### 3. Apply the database schema

```bash
supabase migration up
```

This applies the versioned SQL files in `supabase/migrations/`. Those migrations
are generated and reviewed from the declarative source of truth in
`supabase/schemas/`.

### 4. Create storage buckets

```bash
pnpm exec supabase seed buckets
```

This provisions the `avatars` and `uploads` storage buckets defined in `supabase/config.toml`.
Buckets are **not** auto-created by `supabase start` — this step is required for image uploads to work.

### 5. Start the app and Zero Cache

In one terminal:

```bash
pnpm run dev
```

In a second terminal:

```bash
pnpm run zero:dev
```

## Where to Find What

| Service               | URL                                                       | Description                                    |
| --------------------- | --------------------------------------------------------- | ---------------------------------------------- |
| **App (Dev)**         | [http://localhost:3000](http://localhost:3000)            | Polity frontend (TanStack Start / Vinxi)       |
| **Supabase Studio**   | [http://localhost:54323](http://localhost:54323)          | Database GUI, table editor, SQL editor         |
| **Supabase API**      | [http://localhost:54321](http://localhost:54321)          | Supabase REST & Auth API                       |
| **Supabase Inbucket** | [http://localhost:54324](http://localhost:54324)          | Local email inbox (captures auth emails, OTPs) |
| **Postgres (direct)** | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` | Direct DB connection (e.g. for psql, DBeaver)  |
| **Zero Cache**        | [http://localhost:4848](http://localhost:4848)            | Zero sync engine (realtime cache server)       |

---

## All pnpm Scripts

| Command                    | Description                                         |
| -------------------------- | --------------------------------------------------- |
| `pnpm run dev`             | Start the dev server on port 3000                   |
| `pnpm run build`           | Production build                                    |
| `pnpm run start`           | Start the production server                         |
| `pnpm run lint`            | Lint with Oxlint                                    |
| `pnpm run lint:check`      | Check lint rules with Oxlint                        |
| `pnpm run lint:fix`        | Lint and auto-fix                                   |
| `pnpm run stripe:listen`   | Forward supported Stripe test events locally        |
| `pnpm run test`            | Run unit tests with Vitest                          |
| `pnpm run test:e2e`        | Run E2E tests with Playwright                       |
| `pnpm run test:e2e:ui`     | Run E2E tests with Playwright UI                    |
| `pnpm run test:e2e:headed` | Run E2E tests in headed browser                     |
| `pnpm run test:e2e:debug`  | Debug E2E tests with Playwright                     |
| `pnpm run format`          | Format code with Prettier                           |
| `pnpm run format:check`    | Check formatting with Prettier                      |
| `pnpm run supabase:start`  | Start local Supabase                                |
| `pnpm run supabase:stop`   | Stop local Supabase                                 |
| `pnpm run zero:cache`      | Start zero-cache-dev with short local CVR retention |
| `pnpm run zero:dev`        | Start zero-cache-dev with local DB/API settings     |
| `pnpm run zero:stats`      | Summarize local Zero CVR and query statistics       |
| `pnpm run zero:clean`      | Remove the stopped local Zero replica safely        |
| `pnpm run deploy`          | Run the interactive deploy script                   |
| `pnpm run deploy:dry`      | Run the deploy script in dry-run mode               |
| `pnpm run prepare`         | Install Husky git hooks                             |

## Deployment

The project deploys to three services:

| Service      | Target                                        | Purpose                       |
| ------------ | --------------------------------------------- | ----------------------------- |
| **Supabase** | [supabase.com](https://supabase.com/) (cloud) | Postgres database + Auth      |
| **Fly.io**   | `zero.polity.live` / `polity-zero.fly.dev`    | zero-cache (realtime sync)    |
| **Vercel**   | `www.polity.live`                             | SSR frontend (TanStack Start) |

### Deploy script

```bash
pnpm run deploy          # Interactive target selection
pnpm run deploy:dry      # Interactive dry-run (prints commands without executing)
pnpm run deploy --all # Full deploy without prompt: Supabase → Fly.io → Vercel
```

Skip individual steps with flags:

```bash
pnpm run deploy --skip-supabase --skip-fly # Only frontend to Vercel
pnpm run deploy --skip-supabase   # Skip Supabase migrations
pnpm run deploy --skip-fly        # Skip Fly.io deploy
pnpm run deploy --skip-vercel     # Skip Vercel deploy
```

The script enforces that you are on the `master` or `deploy` branch.

> **Zero schema changes:** After applying migrations that add or change synced tables
> (including the Eurostat snapshot and chart projection tables), restart or redeploy
> `zero-cache` before deploying the frontend. The full deploy script already applies
> Supabase migrations before the Fly.io deployment.

### First-time setup

#### 1. Install CLIs

```bash
pnpm exec supabase --version # Supabase CLI from this repository
pnpm add --global vercel     # Vercel CLI
# Fly.io CLI: https://fly.io/docs/flyctl/install/
```

#### 2. Authenticate

```bash
supabase login
fly auth login
vercel login
```

#### 3. Link Vercel project

```bash
vercel link
```

#### 4. Create Fly.io app & volume

```bash
fly apps create polity-zero --machines
fly volumes create zero_data --region fra --size 1
fly ips allocate-v4 --shared
fly ips allocate-v6
```

#### 5. Set Fly.io secrets

```bash
fly secrets set ZERO_UPSTREAM_DB="postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres?sslmode=require"
fly secrets set ZERO_CVR_DB="postgresql://postgres.PROJECT:PASSWORD@aws-1-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require"
fly secrets set ZERO_CHANGE_DB="postgresql://postgres.PROJECT:PASSWORD@aws-1-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require"
fly secrets set ZERO_ADMIN_PASSWORD="your-strong-password"
fly secrets set ZERO_QUERY_URL="https://your-app-domain.example/api/query"
fly secrets set ZERO_MUTATE_URL="https://your-app-domain.example/api/mutate"
```

#### 6. Custom domain (optional)

Add DNS records for `zero.your-domain.example` pointing to your Fly.io IPs (A + AAAA), plus an ACME challenge CNAME for TLS:

```bash
fly certs create zero.your-domain.example
fly certs setup zero.your-domain.example   # Shows required DNS records
```

### Fly.io secrets reference

| Secret                | Value                                                                         | Notes                                                |
| --------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------- |
| `ZERO_UPSTREAM_DB`    | `postgresql://postgres:PASS@db.PROJECT.supabase.co:5432/postgres`             | **Direct** connection (required for WAL replication) |
| `ZERO_CVR_DB`         | `postgresql://postgres.PROJECT:PASS@REGION.pooler.supabase.com:5432/postgres` | **Session pooler** (supports prepared statements)    |
| `ZERO_CHANGE_DB`      | `postgresql://postgres.PROJECT:PASS@REGION.pooler.supabase.com:5432/postgres` | **Session pooler** (supports prepared statements)    |
| `ZERO_ADMIN_PASSWORD` | Any strong password                                                           | Protects zero-cache admin endpoints                  |
| `ZERO_QUERY_URL`      | `https://your-app-domain/api/query`                                           | Custom query handler on Vercel (delegates auth)      |
| `ZERO_MUTATE_URL`     | `https://your-app-domain/api/mutate`                                          | Custom mutate handler on Vercel (delegates auth)     |

> **Connection strategy:** UPSTREAM uses the direct Supabase connection (Fly.io supports outbound IPv6 natively). CVR and CHANGE use the session pooler to avoid exhausting direct connection slots on Supabase free tier.

---

## Project Structure

```
app/              # TanStack Start entry points (client, ssr, router)
public/           # Static assets, icons, manifest, service worker
src/routes/       # File-based route pages
src/features/     # Feature modules and colocated UI, hooks, logic, tests
src/layout/       # App shell and layout wrappers
src/lib/          # Shared client/server library helpers
src/presence/     # Supabase realtime presence helpers
src/providers/    # App-level React providers
src/server/       # Server functions and external API integrations
src/styles/       # Shared CSS modules and animation styles
src/zero/         # Zero schema & sync setup
supabase/         # Supabase config & schema SQL
tools/deploy/     # Deployment helpers
```

## List and Grid Virtualization Pattern

For long lists, feeds, tables, grids, kanban columns, timelines, notification
lists, and search-like result surfaces, use the shared virtualization
infrastructure in `src/features/shared/virtualization`.

- Use `usePolityZeroList` for vertical lists backed by `@rocicorp/zero-virtual`
  0.6.
- Use `usePolityZeroGrid` for responsive grids, masonry-style feeds, lanes,
  kanban columns, and card layouts backed by TanStack virtualization.
- Do not load full arrays and then apply client-side `slice()` paging for
  paginated UI.
- Virtualized page queries should use `{ limit, start, dir, ...filter }`. The
  `start` cursor must include every sort field plus `id`.
- Add a matching single-item query, such as `thingById`, whenever deep links,
  selected rows, map selections, or back navigation need permalink resolution.
- Keep `limit` compatible with query schemas and virtual lookahead windows. Do
  not reintroduce `.max(100)` validation failures for virtualized pages.
- Filter, tab, sort, entity id, and view mode values form the stable list
  context. Context changes reset the window; live updates preserve the visible
  anchor.
- Loaded rows and skeleton placeholders need stable keys plus virtual row
  attributes where applicable, including `data-vrow-index` and `data-vrow-key`
  for zero-virtual rows.
- Use count queries only when the UI displays totals or requires a stable
  scrollbar/count.
- Prefer query-side filtering and sorting. Do not apply unsupported filters
  after paging over an incomplete page without clearly validating that
  limitation.
- Preserve scroll restoration, new-result indicators, dynamic measurement, and
  anchor stability when mutating, inserting, deleting, or reordering rows.

## Tech Stack

- **Framework**: [TanStack Start](https://tanstack.com/start) (Vinxi)
- **Database**: [Supabase](https://supabase.com/) (Postgres) + [Zero](https://zero.rocicorp.dev/) (realtime sync)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)
- **Editor**: [Plate.js](https://platejs.org/) — Rich text collaborative editor
- **AI**: Custom AI assistants (Aria & Kai) powered by OpenRouter, with bring-your-own-key support for OpenRouter, OpenAI, and Anthropic
- **Auth**: Supabase Auth (email OTP)
- **Testing**: Vitest + Playwright
- **i18n**: i18next (German & English)

---

## Contributing

- 💻 **Code**: Fix bugs, add features, improve tests
- 🎨 **Design**: Improve UX/UI ([Figma](https://www.figma.com/proto/cAT8Aonu8P7ojwgnKcVlkz/Polity))
- 📝 **Docs**: Write guides, tutorials, API docs
- 🐛 **Testing**: Report bugs, write test cases

## Community

- **Email**: tobias.hassebrock@gmail.com

---

**⚠️ Early Alpha** — Database resets can happen. Use with caution!
