-- OPTIONAL. Do not apply with the pricing engine unless Kevin wants these values cleared.
-- Apply after 20261021_pricing_engine.sql.
--
-- product_costs.internal_margin is retired and is not read by the pricing engine.
-- Values at or above 100 are treated as a rupee difference saved in a percent column
-- (for example 750), not as a margin percent. Smaller values are left untouched.
-- Idempotent: a second run updates nothing.

begin;

update public.product_costs
set internal_margin = null,
    updated_at = now()
where internal_margin is not null
  and internal_margin >= 100;

comment on column public.product_costs.internal_margin is
  'Retired. Not read by the pricing engine. This migration nulls values >= 100.';

commit;
