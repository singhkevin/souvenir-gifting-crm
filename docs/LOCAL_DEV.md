# Local host surfaces

`next dev` listens on port 3000. Browsers resolve `*.localhost` to `127.0.0.1`, so these URLs work with no `/etc/hosts` edits.

Production hosts (`souvenirgifting.com`, `admin.souvenirgifting.com`, `giftingstore.online`) are unchanged. The names below apply only when `.env` points the split at `*.localhost`.

## Env

Put this in `.env` (it overrides the production `ROOT_DOMAIN` line):

```
DOMAIN_SPLIT=1
ROOT_DOMAIN=portal.localhost
PORTAL_ROOT_DOMAIN=portal.localhost
STORE_DOMAIN=store.localhost
ADMIN_HOST=admin.localhost
PORT=3000
```

Leave `DOMAIN_SPLIT` unset to keep today's single-host app on `http://localhost:3000`.

## URLs

| Surface | URL |
| --- | --- |
| Store | http://localhost:3000 and http://store.localhost:3000 |
| Business portal (`/business`) | http://localhost:3000/business and http://store.localhost:3000/business |
| Admin CRM | http://admin.localhost:3000 |
| Company finder | http://portal.localhost:3000 |
| Company portal / microsite | http://acme.portal.localhost:3000 (replace `acme` with the company `portal_slug`) |

Company catalogue: `http://acme.portal.localhost:3000/portal/catalogue`. Company sign-in: `http://acme.portal.localhost:3000/login`.

Auth cookies are host-only (no `Domain` attribute). `http://admin.localhost:3000` does not share a session with the store or a company host, matching production. Browsers reject `Domain=localhost`.

## Supabase Auth redirect URLs

In the Supabase dashboard for this project, add:

- `http://localhost:3000/**`
- `http://*.localhost:3000/**`
- `http://*.portal.localhost:3000/**`

`http://*.localhost:3000/**` covers `store`, `admin`, and `portal`. The extra `*.portal.localhost` line covers company hosts (`acme.portal.localhost`), which are two labels deep. Bare `localhost` needs its own line.
