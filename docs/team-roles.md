# Team roles · who can do what (audit 23 Oct 2026)

Y = nav link + page + data. R = read-only. – = no access. Pages are guarded by `requireStaff([...])`;
data by RLS. This branch makes nav, page guards and RLS agree.

| Area | admin | sales | operations | accounts | management | runner |
|---|---|---|---|---|---|---|
| Dashboard · My Work · Tasks · Announcements · Knowledge | Y | Y | Y | Y | Y | – |
| Companies | Y | Y (own) | R | R | Y | – |
| Contacts · Leads · Goals · Catalogs · Storefront | Y | Y | – | – | Y | – |
| Requirements · Quotations | Y | Y (own) | – | – | Y | – |
| Products · Mockup Storage | Y | Y | Y | – | Y | – |
| Pricing | Y | Y (no cost) | – | Y | Y | – |
| Orders · Control Center · Department | Y | Y (own) | Y (assigned/dept) | R | Y | – |
| Order Fulfilment tab (act) | Y | approve branding | Y | – | R | – |
| Runs | Y | – | Y | – | R | own jobs only |
| Suppliers · Printing · Delivery partners · Samples | Y | – | Y | – | Y | – |
| Gift selection · Presentations | Y | Y | Y | – | Y | – |
| Invoices · Payments · Receivables · Payables · GST | Y | – | – | Y | Y | – |
| Reports | Y | – | – | Y | Y | – |
| Tracking · Reviews · Activities · Audit log | Y | – | – | – | Y | – |
| Team · Catalogue setup · Settings · Lifecycle settings | Y | – | – | – | – | – |

Portal roles (not staff, managed from the company page):
client_admin and client_user (company portal; today both have the same portal access, client_admin
also gets admin notifications), business_user (/business), gift_employee (/gift).

Adding staff: Team (/crm/team) → Add team member (admin only). No invite email is sent; the
temporary password is shown once. Deactivating sets Status = Inactive; migration
20261023c_role_active_checks.sql makes that also remove database access.
