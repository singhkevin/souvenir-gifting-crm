# Souvenir Gifting Solutions

B2B corporate gifting CRM/ERP. Manage a customer from first enquiry through fulfilment, invoice, and payment.

## Stack

Next.js 16, TypeScript, Tailwind CSS 4, Supabase (Postgres, Auth, Storage, RLS).

## Local setup

```bash
npm install
cp .env.example .env
npm run dev
```

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env`.

Admin-created portal client logins also require the **server-only** variable `SUPABASE_SERVICE_ROLE_KEY`. Never prefix this key with `NEXT_PUBLIC_`. On Vercel, add it under Project Settings → Environment Variables (Production).

Password recovery uses the request host (`http://localhost:3000` locally, `https://giffter.vercel.app` in production). `resetPasswordForEmail` sets `redirectTo` to `/reset-password`. Query tokens (`code`, `token_hash`) are exchanged once at `/auth/confirm`; hash tokens are handled on `/reset-password`.

Request a reset from the same environment you will open the email in. A localhost request produces a localhost link; a production request produces a production link.

In the Supabase dashboard, Authentication → URL Configuration must include:

- Site URL: `https://giffter.vercel.app` (the site origin, not `/login`)
- Redirect URLs:
  - `http://localhost:3000/auth/confirm`
  - `http://localhost:3000/reset-password`
  - `https://giffter.vercel.app/auth/confirm`
  - `https://giffter.vercel.app/reset-password`

Optional wildcards if needed: `http://localhost:3000/**` and `https://giffter.vercel.app/**`.

Reset password email template (Authentication → Email Templates → Reset password) should use the token-hash confirm link so recovery does not depend on a PKCE cookie from the original browser:

```html
<h2>Reset your password</h2>
<p>Follow the link below to choose a new password.</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Reset password</a></p>
```

Open http://localhost:3000

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

## Deploy

Production:

https://giffter.vercel.app/

Repository: https://github.com/VIAayush/corporate-gifting-crm

Database project: `ajysowosgjaipczrwpfv` (ap-south-1).



