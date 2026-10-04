-- A sale creates one commission-calculation row for each salesperson, not one
-- row total. The composite uniqueness rule in the base schema is the intended
-- guard; remove the accidental single-row-per-sale constraint from the live DB.
alter table public.commission_calculations
  drop constraint if exists commission_calculations_sale_transaction_id_key;
