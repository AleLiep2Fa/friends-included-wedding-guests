-- The assignment specifies SYNC-CHECK-001 as the temporary live Sheets-control record.
alter table public.transactions drop constraint transactions_reference_check;
alter table public.transactions add constraint transactions_reference_check
  check (reference ~ '^(?:[A-Z][0-9]{2,}|SYNC-CHECK-[0-9]{3,})$');
