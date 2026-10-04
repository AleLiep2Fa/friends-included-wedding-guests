-- PostgreSQL also resolves the CASE used for the expense status as text unless
-- each branch is explicitly typed as the enum.
create or replace function public.submit_expense(p_actor text, p_source public.transaction_source, p_chat_id bigint, p_value jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_reference text := upper(trim(p_value->>'reference')); v_allocation public.expense_allocation := (p_value->>'proposedAllocation')::public.expense_allocation;
begin
  perform assert_actor_role(p_actor, 'EXPENSE_REPORTER');
  if v_reference !~ '^(?:[A-Z][0-9]{2,}|SYNC-CHECK-[0-9]{3,})$' then raise exception 'Invalid transaction reference'; end if;
  insert into transactions(reference, kind, source, submitter_id, originating_telegram_chat_id)
  values(v_reference, 'EXPENSE', p_source, p_actor, p_chat_id) returning id into v_id;
  insert into expenses(transaction_id, description, category, amount_cents, proposed_allocation, final_allocation, status)
  values(v_id, trim(p_value->>'description'), upper(p_value->>'category'), (p_value->>'amountCents')::bigint, v_allocation,
    case when v_allocation = 'OVERHEAD' then 'OVERHEAD'::public.expense_allocation else null end,
    case when v_allocation = 'OVERHEAD' then 'ALLOCATED'::public.expense_status else 'AWAITING_ALLOCATION'::public.expense_status end);
  return v_id;
end; $$;
