-- Postgres cannot drop an enum value. Deactivate runner logins instead.
update public.profiles set is_active = false where role::text = 'runner';
