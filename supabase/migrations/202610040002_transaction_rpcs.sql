-- These RPCs keep each submission/decision atomic in Postgres. They accept only server-validated values.
create or replace function public.assert_actor_role(p_actor text, p_role public.employee_role)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from employees where id = p_actor and role = p_role) then
    raise exception 'Actor is not permitted to perform this action' using errcode = '42501';
  end if;
end; $$;

create or replace function public.submit_sale(p_actor text, p_source public.transaction_source, p_chat_id bigint, p_value jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_reference text := upper(trim(p_value->>'reference'));
begin
  perform assert_actor_role(p_actor, 'SALESPERSON');
  if v_reference !~ '^[A-Z][0-9]{2,}$' then raise exception 'Invalid transaction reference'; end if;
  insert into transactions(reference, kind, source, submitter_id, originating_telegram_chat_id)
  values(v_reference, 'SALE', p_source, p_actor, p_chat_id) returning id into v_id;
  insert into sales(transaction_id, customer, project, description, amount_cents, proposed_richard_bps, proposed_anastasia_bps, proposed_jean_claude_bps)
  values(v_id, trim(p_value->>'customer'), (p_value->>'project')::project_code, trim(p_value->>'description'), (p_value->>'amountCents')::bigint,
    (p_value->'proposedSplit'->>'richard')::integer, (p_value->'proposedSplit'->>'anastasia')::integer, (p_value->'proposedSplit'->>'jeanClaude')::integer);
  return v_id;
end; $$;

create or replace function public.submit_expense(p_actor text, p_source public.transaction_source, p_chat_id bigint, p_value jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_reference text := upper(trim(p_value->>'reference')); v_allocation public.expense_allocation := (p_value->>'proposedAllocation')::public.expense_allocation;
begin
  perform assert_actor_role(p_actor, 'EXPENSE_REPORTER');
  if v_reference !~ '^[A-Z][0-9]{2,}$' then raise exception 'Invalid transaction reference'; end if;
  insert into transactions(reference, kind, source, submitter_id, originating_telegram_chat_id)
  values(v_reference, 'EXPENSE', p_source, p_actor, p_chat_id) returning id into v_id;
  insert into expenses(transaction_id, description, category, amount_cents, proposed_allocation, final_allocation, status)
  values(v_id, trim(p_value->>'description'), upper(p_value->>'category'), (p_value->>'amountCents')::bigint, v_allocation,
    case when v_allocation = 'OVERHEAD' then 'OVERHEAD' else null end,
    case when v_allocation = 'OVERHEAD' then 'ALLOCATED' else 'AWAITING_ALLOCATION' end);
  return v_id;
end; $$;

create or replace function public.approve_sale(p_manager text, p_reference text, p_split jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_sale sales%rowtype; v_pool bigint; v_r bigint; v_a bigint; v_j bigint; v_diff bigint; v_max integer;
  v_r_bps integer := (p_split->>'richard')::integer; v_a_bps integer := (p_split->>'anastasia')::integer; v_j_bps integer := (p_split->>'jeanClaude')::integer;
begin
  perform assert_actor_role(p_manager, 'MANAGER');
  if v_r_bps < 0 or v_a_bps < 0 or v_j_bps < 0 or v_r_bps > 10000 or v_a_bps > 10000 or v_j_bps > 10000 or v_r_bps + v_a_bps + v_j_bps <> 10000 then
    raise exception 'Commission shares must total exactly 100%%';
  end if;
  select s.* into v_sale from sales s join transactions t on t.id=s.transaction_id where t.reference=upper(trim(p_reference)) for update;
  if not found then raise exception 'Sale not found'; end if;
  if v_sale.status = 'APPROVED' then return false; end if;
  v_pool := floor((v_sale.amount_cents + 5) / 10.0);
  v_r := floor(v_pool * v_r_bps / 10000.0); v_a := floor(v_pool * v_a_bps / 10000.0); v_j := floor(v_pool * v_j_bps / 10000.0);
  v_diff := v_pool - v_r - v_a - v_j; v_max := greatest(v_r_bps, v_a_bps, v_j_bps);
  if v_r_bps = v_max then v_r := v_r + v_diff;
  elsif v_a_bps = v_max then v_a := v_a + v_diff;
  else v_j := v_j + v_diff; end if;
  update sales set status='APPROVED', final_richard_bps=v_r_bps, final_anastasia_bps=v_a_bps, final_jean_claude_bps=v_j_bps,
    commission_pool_cents=v_pool, richard_commission_cents=v_r, anastasia_commission_cents=v_a, jean_claude_commission_cents=v_j,
    approved_at=now(), approved_by=p_manager where transaction_id=v_sale.transaction_id;
  insert into manager_decisions(transaction_id, manager_id, original_proposal, final_decision) values
    (v_sale.transaction_id, p_manager, jsonb_build_object('richard',v_sale.proposed_richard_bps,'anastasia',v_sale.proposed_anastasia_bps,'jeanClaude',v_sale.proposed_jean_claude_bps), p_split);
  insert into commission_calculations(sale_transaction_id, person_id, final_basis_points, amount_cents) values
    (v_sale.transaction_id,'richard',v_r_bps,v_r),(v_sale.transaction_id,'anastasia',v_a_bps,v_a),(v_sale.transaction_id,'jean-claude',v_j_bps,v_j);
  update transactions set notification_state='PENDING', sync_state='PENDING' where id=v_sale.transaction_id;
  return true;
end; $$;

create or replace function public.approve_expense(p_manager text, p_reference text, p_allocation public.expense_allocation)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_expense expenses%rowtype;
begin
  perform assert_actor_role(p_manager, 'MANAGER');
  select e.* into v_expense from expenses e join transactions t on t.id=e.transaction_id where t.reference=upper(trim(p_reference)) for update;
  if not found then raise exception 'Expense not found'; end if;
  if v_expense.status = 'ALLOCATED' then return false; end if;
  update expenses set status='ALLOCATED', final_allocation=p_allocation, approved_at=now(), approved_by=p_manager where transaction_id=v_expense.transaction_id;
  insert into manager_decisions(transaction_id, manager_id, original_proposal, final_decision) values
    (v_expense.transaction_id,p_manager,jsonb_build_object('allocation',v_expense.proposed_allocation),jsonb_build_object('allocation',p_allocation));
  update transactions set notification_state='PENDING', sync_state='PENDING' where id=v_expense.transaction_id;
  return true;
end; $$;

revoke all on all tables in schema public from anon, authenticated;
revoke all on function public.submit_sale(text, public.transaction_source, bigint, jsonb) from public;
revoke all on function public.submit_expense(text, public.transaction_source, bigint, jsonb) from public;
revoke all on function public.approve_sale(text, text, jsonb) from public;
revoke all on function public.approve_expense(text, text, public.expense_allocation) from public;
