-- Channel prices differ: company (B2B) → channel → product → global.
-- Base is supplier cost, or list price when cost is missing.

create or replace function public.resolved_sell_price(
  p_supplier_cost numeric,
  p_list_price numeric,
  p_product_margin numeric,
  p_company_margin numeric,
  p_channel text
)
returns numeric
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_global numeric;
  v_b2c numeric;
  v_b2b numeric;
  v_margin numeric;
  v_base numeric;
begin
  select default_margin_percent, b2c_margin_percent, b2b_margin_percent
    into v_global, v_b2c, v_b2b
  from public.org_settings
  limit 1;

  if lower(coalesce(p_channel, 'b2b')) = 'b2c' then
    v_margin := coalesce(v_b2c, p_product_margin, v_global);
  else
    v_margin := coalesce(p_company_margin, v_b2b, p_product_margin, v_global);
  end if;

  v_base := coalesce(p_supplier_cost, p_list_price);

  if v_base is not null and v_margin is not null then
    return round(v_base * (1 + v_margin / 100.0), 2);
  end if;

  return round(coalesce(v_base, 0)::numeric, 2);
end;
$$;
