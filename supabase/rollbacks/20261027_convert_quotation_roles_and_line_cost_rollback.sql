-- Rollback for 20261027_convert_quotation_roles_and_line_cost.sql.
-- Restores admin/sales/operations and the effective_product_cost-only order cost.
-- Does not rewrite the rest of convert_quotation_to_order.

do $patch$
declare
  v_def text;
  v_old text;
  v_new text;
  v_hits integer;
begin
  v_def := pg_get_functiondef('public.convert_quotation_to_order(uuid)'::regprocedure);

  v_old := $o$array['admin','sales','management']::public.app_role[]$o$;
  v_new := $n$array['admin','sales','operations']::public.app_role[]$n$;
  if position(v_new in v_def) = 0 then
    v_hits := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
    if v_hits <> 1 then
      raise exception 'convert_quotation_to_order rollback: expected 1 role check, found %', v_hits;
    end if;
    v_def := replace(v_def, v_old, v_new);
  end if;

  v_old := $o$coalesce((select qic.supplier_cost from public.quotation_item_costs qic where qic.quotation_item_id = qi.id), public.effective_product_cost(p.id, qi.quantity::integer, public.company_pricing_portal(q.company_id)), 0)$o$;
  v_new := $n$coalesce(public.effective_product_cost(p.id, qi.quantity::integer, public.company_pricing_portal(q.company_id)), 0)$n$;
  if position('quotation_item_costs qic' in v_def) > 0 then
    v_hits := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
    if v_hits <> 1 then
      raise exception 'convert_quotation_to_order rollback: expected 1 quote cost, found %', v_hits;
    end if;
    v_def := replace(v_def, v_old, v_new);
  end if;

  execute v_def;
end;
$patch$;
