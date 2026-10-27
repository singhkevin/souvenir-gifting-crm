-- convert_quotation_to_order: who may convert, and which cost lands on the order.
--
-- Before: the quote page let admin, sales and management through, the server
-- action allowed only admin and sales, and this function allowed admin, sales
-- and operations. Order product_cost used effective_product_cost (previously
-- product_costs or price * 0.62) and ignored quotation_item_costs.
-- After: admin, sales and management may convert. Each converted line uses
-- quotation_item_costs.supplier_cost when that line has one, and otherwise
-- the same effective_product_cost fallback as today.
--
-- The function body is patched in place. Channel visibility, order source,
-- and the order line lifecycle are left as they are.
-- Depends on 20261022_pricing_cost_basis_cutover.sql (the cost expression).
-- Not applied. Rollback: supabase/rollbacks/20261027_convert_quotation_roles_and_line_cost_rollback.sql

do $patch$
declare
  v_def text;
  v_old text;
  v_new text;
  v_hits integer;
begin
  v_def := pg_get_functiondef('public.convert_quotation_to_order(uuid)'::regprocedure);

  v_old := $o$array['admin','sales','operations']::public.app_role[]$o$;
  v_new := $n$array['admin','sales','management']::public.app_role[]$n$;
  if position(v_new in v_def) = 0 then
    v_hits := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
    if v_hits <> 1 then
      raise exception 'convert_quotation_to_order: expected 1 role check, found %', v_hits;
    end if;
    v_def := replace(v_def, v_old, v_new);
  end if;

  v_old := $o$coalesce(public.effective_product_cost(p.id, qi.quantity::integer, public.company_pricing_portal(q.company_id)), 0)$o$;
  v_new := $n$coalesce((select qic.supplier_cost from public.quotation_item_costs qic where qic.quotation_item_id = qi.id), public.effective_product_cost(p.id, qi.quantity::integer, public.company_pricing_portal(q.company_id)), 0)$n$;
  if position('quotation_item_costs qic' in v_def) = 0 then
    v_hits := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
    if v_hits <> 1 then
      raise exception 'convert_quotation_to_order: expected 1 cost expression, found %', v_hits;
    end if;
    v_def := replace(v_def, v_old, v_new);
  end if;

  execute v_def;
end;
$patch$;
