# Souvenir - Gifting Solutions

B2B corporate gifting CRM/ERP. Manage a customer from first enquiry through fulfilment, invoice, and payment.

## Stack

Next.js 16, TypeScript, Tailwind CSS 4, Supabase (Postgres, Auth, Storage, RLS).

## Local development

### Prerequisites

- Node.js 20.9 or newer (Next.js 16 minimum). The repo pins no version (no `.nvmrc` or `engines`). Use Node 23.6+ if you want to run the unit tests without flags.
- npm (the repo ships `package-lock.json`).
- Access to a Supabase project (URL, anon key, and service role key).

### 1. Install and configure

```bash
npm install
cp .env.example .env.local
```

`.env*` files are git-ignored except `.env.example`. Fill in `.env.local`. Never commit values.

Required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; never prefix with `NEXT_PUBLIC_`)

Local host split (to test the store, admin, finder, and company portals on one server). Comment out the production `ROOT_DOMAIN` line and set:

- `DOMAIN_SPLIT=1`
- `ROOT_DOMAIN=portal.localhost`
- `PORTAL_ROOT_DOMAIN=portal.localhost`
- `STORE_DOMAIN=store.localhost`
- `ADMIN_HOST=admin.localhost`
- `PORT=3000`

Leave `DOMAIN_SPLIT` unset to run the old single-host app on `http://localhost:3000`.

Optional: `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_SHORT_NAME`, `NEXT_PUBLIC_SITE_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (an empty Turnstile secret skips the check outside production), `PUBLIC_CONTACT_PHONE`, `CRON_SECRET`. See `.env.example` for the full list.

> **Warning:** local development uses whatever database `.env.local` points at. With the production Supabase keys, every action on localhost (orders, quotes, registrations, emails, deletes) hits the **live** database. Point `NEXT_PUBLIC_SUPABASE_URL` and the keys at a separate project or Supabase branch for anything destructive.

### 2. Run

```bash
npm run dev
```

If port 3000 is busy:

```bash
lsof -ti:3000 | xargs kill -9
```

### 3. Local URLs

Browsers resolve `*.localhost` to `127.0.0.1`, so no `/etc/hosts` edits are needed. These assume the local host split above.

| Surface | URL |
| --- | --- |
| Store | http://localhost:3000 (also http://store.localhost:3000) |
| Business portal | http://localhost:3000/business |
| Admin CRM | http://admin.localhost:3000 |
| Portal finder | http://portal.localhost:3000 |
| Company portal | http://`<code>`.portal.localhost:3000 (`<code>` is the company `portal_slug`) |

Sessions are host-only, so signing in on `admin.localhost` does not sign you in on the store or a company host (same as production). More detail: `docs/LOCAL_DEV.md`.

### 4. Supabase redirect URLs

Supabase dashboard → Authentication → URL Configuration → Redirect URLs. Add:

- `http://localhost:3000/**`
- `http://*.localhost:3000/**` (store, admin, portal finder)
- `http://*.portal.localhost:3000/**` (company portals are two labels deep)

### 5. Logging in as each role

Use the demo users listed under [Demo users](#demo-users), or your own accounts. Passwords are not in this section.

- **Staff (Admin, Sales, Operations, Accounts, Management):** sign in at http://admin.localhost:3000/login. Operations accounts have no cost or margin access.
- **Client admin / client user:** open the company host, e.g. http://`<code>`.portal.localhost:3000/login, with a user whose profile belongs to that company.
- **Business (self-registered) buyer:** register or sign in at http://localhost:3000/business. Registration needs `SUPABASE_SERVICE_ROLE_KEY`.

Without the host split, every role signs in at http://localhost:3000/login.

### 6. Type check and tests

```bash
npx tsc --noEmit
npm run lint
node --test test/*.test.ts
```

Tests use the built-in `node:test` runner with native TypeScript stripping (Node 23.6+; on 22.6–23.5 add `--experimental-strip-types`). Note: as of Oct 2026, tests whose source files import through the `@/` path alias fail to load under plain Node (`ERR_MODULE_NOT_FOUND`). That is a runner limitation, not a test failure.

SQL checks live in `supabase/tests/`. They roll back or abort on their own, but still run them only against a non-production database or inside a transaction you roll back.

### 7. Database migrations

- Forward migrations: `supabase/migrations/YYYYMMDD_name.sql`. Each has a matching `supabase/rollbacks/YYYYMMDD_name_rollback.sql`.
- Order: `supabase/migrations/APPLY_ORDER.md`. Add every new migration there with its number and rollback.
- Migrations are **applied manually** (Supabase SQL editor or an approved operator), in `APPLY_ORDER.md` order, after a backup of the affected data. Nothing runs them automatically on deploy or `npm run dev`.
- Ship the code that depends on a migration only after that migration is applied.

### Auth redirects (production)

Password recovery uses the request host (`http://localhost:3000` locally, `https://www.giftingstore.online` in production). `resetPasswordForEmail` sets `redirectTo` to `/reset-password`. Query tokens (`code`, `token_hash`) are exchanged once at `/auth/confirm`; hash tokens are handled on `/reset-password`.

Request a reset from the same environment you will open the email in. A localhost request produces a localhost link; a production request produces a production link.

In the Supabase dashboard, Authentication → URL Configuration must include:

- Site URL: `https://www.giftingstore.online` (the site origin, not `/login`)
- Redirect URLs:
  - `http://localhost:3000/auth/confirm`
  - `http://localhost:3000/reset-password`
  - `https://www.giftingstore.online/auth/confirm`
  - `https://www.giftingstore.online/reset-password`
  - `https://giftingstore.online/auth/confirm`
  - `https://giftingstore.online/reset-password`
  - `https://*.giftingstore.online/**` (company portal sign-in and password reset)

Also allow `http://localhost:3000/**`, `https://www.giftingstore.online/**`, and `https://giftingstore.online/**`. The `*.vercel.app` alias stays the main site and does not serve company subdomains.

Reset password email template (Authentication → Email Templates → Reset password) should use the token-hash confirm link so recovery does not depend on a PKCE cookie from the original browser:

```html
<h2>Reset your password</h2>
<p>Follow the link below to choose a new password.</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Reset password</a></p>
```


## Demo users

Seeded Auth users (developer reference only — not shown on the production login screen).
The `*@oaklane.demo` addresses are real Supabase identities and must not be renamed.

Password for all demo users: `Oaklane-Demo-2026!`

- `admin@oaklane.demo` — Admin
- `sales@oaklane.demo` — Sales
- `ops@oaklane.demo` — Operations
- `accounts@oaklane.demo` — Accounts
- `management@oaklane.demo` — Management
- `priya@wipro.example` — Client Admin (Wipro)
- `rahul@nexora.example` — Client Admin (Nexora)

## Brand and domains

Public copy reads the variables in `.env.example`. When a variable is unset, the app uses the production default.

| Variable | Production value | Role |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_NAME` | `Souvenir - Gifting Solutions` | Titles, logo alt text, emails, copyright, organisation-name default |
| `NEXT_PUBLIC_APP_SHORT_NAME` | `Souvenir` | PWA name, install hint, compact labels |
| `NEXT_PUBLIC_SITE_URL` | `https://www.giftingstore.online` | Canonical origin (`metadataBase`, Open Graph) |
| `ROOT_DOMAIN` | `giftingstore.online` | Company portals at `https://{slug}.giftingstore.online` |
| `NEXT_PUBLIC_MARKETING_URL` | unset | Optional. Example: `https://souvenirgifting.com`. Footer link only when set. |
| `RESEND_FROM_EMAIL` | `Souvenir - Gifting Solutions <catalogs@giftingstore.online>` | Transactional From, after that domain is verified in Resend |

`www.giftingstore.online` and `giftingstore.online` are the same CRM. `*.vercel.app` stays the main site and does not serve company subdomains. `souvenirgifting.com` is not the portal root and is not an auth host. Leave `NEXT_PUBLIC_MARKETING_URL` unset until that hostname should show in the footer.

Placeholder names (`Gifting Solutions`, `Giffter`, `Oaklane`, `souvenir-gifting-crm`) and the host `souvenir-gifting-crm.vercel.app` are ignored so an old example value cannot replace the product name.

This repository does not change Hostinger DNS, Vercel domain attachment, or the Supabase Auth redirect list. Those stay as documented in the password-recovery section and the company-portal checklist below.

Demo logins `*@oaklane.demo` and the demo password are Supabase credentials. They are not the product name.

## Deploy

Production (Vercel, same project for the CRM and company portals):

https://www.giftingstore.online/

The `*.vercel.app` hostname stays the main CRM. Company portals are `https://{slug}.giftingstore.online` and are **not** created as Hostinger parked domains.

Database project: `ajysowosgjaipczrwpfv` (ap-south-1).

## Company portal hosts

A company with `companies.portal_slug` is served when the request host is `{slug}.ROOT_DOMAIN`. `src/proxy.ts` calls `resolveHost`:

- `www.giftingstore.online`, `giftingstore.online`, `localhost`, and `*.vercel.app` are the main CRM, including `/portal` on those hosts.
- `{slug}.giftingstore.online` is that company's portal. `/crm` on a company host redirects to the apex.
- Unset `ROOT_DOMAIN` keeps every host on the main site.

No per-slug DNS record is required. Vercel answers every label under the wildcard. Existing slugs in `companies.portal_slug` keep working after the wildcard is live; do not re-create Hostinger parked entries.

`POST /api/internal/portal-hosts/run` (optional `CRON_SECRET`) only reconciles `portal_hosts` rows. On Vercel and in production it does not call the Hostinger API. Saving a company still schedules that reconcile in-process. `PORTAL_DNS=hostinger` plus `HOSTINGER_MOCK=1` is a local-only rollback and is ignored when `VERCEL=1` or `NODE_ENV=production`.

### Vercel and DNS checklist

Do this in the Vercel project that already serves www. Kevin verifies DNS by hand.

1. Project → Settings → Environment Variables → Production: `ROOT_DOMAIN=giftingstore.online`. Leave `PORTAL_DNS` unset. Do not set `HOSTINGER_API_TOKEN`, `HOSTINGER_ACCOUNT_USERNAME`, `HOSTINGER_WEBSITE_DOMAIN`, or `HOSTINGER_MOCK`.
2. Redeploy so the proxy picks up `ROOT_DOMAIN`.
3. Project → Settings → Domains. On this same project, confirm `giftingstore.online` and `www.giftingstore.online`, then add `*.giftingstore.online`.
4. Wildcard HTTPS needs Vercel to pass the DNS-01 challenge. Use the records on the domain card. Two setups work:
   - **Nameservers.** At the registrar, set `ns1.vercel-dns.com` and `ns2.vercel-dns.com`. Copy existing MX and TXT mail records into Vercel DNS first. After that, adding the wildcard in the project is enough.
   - **DNS stays at the current host.** Add what Vercel shows for an external provider ([wildcard domains](https://vercel.com/docs/domains/working-with-domains/add-a-domain)):
     - `NS` `_acme-challenge` → `ns1.vercel-dns.com`
     - `NS` `_acme-challenge` → `ns2.vercel-dns.com`
     - `CNAME` `*` → the wildcard target on the domain card (Vercel’s docs use `cname.vercel-dns-0.com`; a project card may show a different `*.vercel-dns-*.com` host)
     - Apex `A` → the IPv4 on the domain card (often `76.76.21.21`)
     - `CNAME` `www` → the www target on the domain card
5. Remove leftover Hostinger parked-domain or per-slug records that would override `*` for company labels. Do not add a regular Hostinger subdomain per company.
6. Disable any Hostinger cron that POSTed `/api/internal/portal-hosts/run`. The route is safe if it still fires; it will not call Hostinger.
7. Supabase → Authentication → URL Configuration: add `https://*.giftingstore.online/**` plus the apex and www wildcards listed above.
8. Manual check after Vercel shows the wildcard as valid:
   - `https://www.giftingstore.online/` is the main CRM.
   - `https://giftingstore.online/` is the main CRM.
   - `https://{known-slug}.giftingstore.online/` redirects toward the company portal login (not the staff CRM).
   - `https://{known-slug}.giftingstore.online/crm` redirects to the apex.
   - A slug that is not in `companies.portal_slug` shows the tenant not-found page.
   - `https://{project}.vercel.app/` stays the main site.



