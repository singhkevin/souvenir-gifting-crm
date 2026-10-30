-- Removes business email-domain rules and restores the hard-coded registration check.
-- Does not delete or deactivate existing business accounts.
-- Do not apply from the agent. If 20261030c is applied, roll that back first.

begin;

do $patch$
declare
  v_def text;
  v_new text := $new$if not public.is_work_email(v_email) then
    raise exception 'work email required';
  end if;$new$;
  v_old text := $old$if split_part(v_email, '@', 2) = any (array[
      'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.in', 'hotmail.com',
      'outlook.com', 'live.com', 'aol.com', 'icloud.com', 'me.com', 'proton.me',
      'protonmail.com', 'zoho.com', 'yandex.com', 'gmx.com', 'mail.com', 'rediffmail.com',
      'mailinator.com', 'guerrillamail.com', 'tempmail.com', '10minutemail.com',
      'yopmail.com', 'trashmail.com', 'sharklasers.com', 'dispostable.com'
    ])
    and not exists (
      select 1 from public.email_domain_allowlist a
      where a.domain = split_part(v_email, '@', 2)
    )
  then
    raise exception 'work email required';
  end if;$old$;
begin
  v_def := pg_get_functiondef('public.register_business_account(jsonb,jsonb)'::regprocedure);
  if position(v_new in v_def) > 0 then
    execute replace(v_def, v_new, v_old);
  end if;
end;
$patch$;

drop trigger if exists profiles_enforce_business_email_domain on public.profiles;
drop trigger if exists email_domain_rules_sync_allowlist on public.email_domain_rules;
drop trigger if exists email_domain_allowlist_sync_rules on public.email_domain_allowlist;

drop view if exists public.business_free_email_review;

drop function if exists public.enforce_business_email_domain();
drop function if exists public.sync_allowlist_from_email_rule();
drop function if exists public.sync_email_rule_from_allowlist();
drop function if exists public.is_work_email(text);
drop function if exists public.email_domain_of(text);

drop table if exists public.email_domain_rules;

commit;
