-- Friends Included Ltd: transaction ledger. The transactions table makes reference unique across sales and expenses.
create extension if not exists pgcrypto;

create type public.employee_role as enum ('MANAGER', 'SALESPERSON', 'EXPENSE_REPORTER');
create type public.transaction_kind as enum ('SALE', 'EXPENSE');
create type public.transaction_source as enum ('WEBSITE', 'TELEGRAM');
create type public.sale_status as enum ('PENDING_APPROVAL', 'APPROVED');
create type public.expense_status as enum ('AWAITING_ALLOCATION', 'ALLOCATED');
create type public.project_code as enum ('A', 'B');
create type public.expense_allocation as enum ('A', 'B', 'OVERHEAD');
create type public.sync_state as enum ('PENDING', 'SYNCED', 'FAILED', 'NOT_CONFIGURED');
create type public.notification_state as enum ('NOT_REQUIRED', 'PENDING', 'SENT', 'FAILED', 'NO_RECIPIENT', 'NOT_CONFIGURED');

create table public.employees (
  id text primary key check (id in ('svetlana','richard','anastasia','jean-claude','kevin')),
  name text not null unique,
  role public.employee_role not null
);
insert into public.employees (id, name, role) values
  ('svetlana','Svetlana de Monte Carlo','MANAGER'),
  ('richard','Richard Darling','SALESPERSON'),
  ('anastasia','Anastasia Ferrari','SALESPERSON'),
  ('jean-claude','Jean-Claude Bērziņš','SALESPERSON'),
  ('kevin','Kevin von Whatever','EXPENSE_REPORTER');

create table public.telegram_employee_links (
  telegram_user_id bigint primary key,
  employee_id text not null unique references public.employees(id),
  chat_id bigint not null,
  linked_at timestamptz not null default now(),
  linked_by text not null references public.employees(id) check (linked_by = 'svetlana')
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique check (reference ~ '^[A-Z][0-9]{2,}$'),
  kind public.transaction_kind not null,
  source public.transaction_source not null,
  submitter_id text not null references public.employees(id),
  originating_telegram_chat_id bigint,
  created_at timestamptz not null default now(),
  sync_state public.sync_state not null default 'PENDING',
  notification_state public.notification_state not null default 'NOT_REQUIRED'
);

create table public.sales (
  transaction_id uuid primary key references public.transactions(id) on delete cascade,
  customer text not null check (length(trim(customer)) > 0),
  project public.project_code not null,
  description text not null check (length(trim(description)) > 0),
  amount_cents bigint not null check (amount_cents > 0),
  status public.sale_status not null default 'PENDING_APPROVAL',
  proposed_richard_bps integer not null check (proposed_richard_bps between 0 and 10000),
  proposed_anastasia_bps integer not null check (proposed_anastasia_bps between 0 and 10000),
  proposed_jean_claude_bps integer not null check (proposed_jean_claude_bps between 0 and 10000),
  final_richard_bps integer check (final_richard_bps between 0 and 10000),
  final_anastasia_bps integer check (final_anastasia_bps between 0 and 10000),
  final_jean_claude_bps integer check (final_jean_claude_bps between 0 and 10000),
  commission_pool_cents bigint not null default 0,
  richard_commission_cents bigint not null default 0,
  anastasia_commission_cents bigint not null default 0,
  jean_claude_commission_cents bigint not null default 0,
  approved_at timestamptz,
  approved_by text references public.employees(id),
  check (proposed_richard_bps + proposed_anastasia_bps + proposed_jean_claude_bps = 10000),
  check ((status = 'PENDING_APPROVAL' and final_richard_bps is null and final_anastasia_bps is null and final_jean_claude_bps is null and commission_pool_cents = 0) or
         (status = 'APPROVED' and final_richard_bps + final_anastasia_bps + final_jean_claude_bps = 10000 and approved_at is not null and approved_by = 'svetlana'))
);

create table public.expenses (
  transaction_id uuid primary key references public.transactions(id) on delete cascade,
  description text not null check (length(trim(description)) > 0),
  category text not null check (category in ('MATERIALS','TRAVEL','OTHER')),
  amount_cents bigint not null check (amount_cents > 0),
  proposed_allocation public.expense_allocation not null,
  final_allocation public.expense_allocation,
  status public.expense_status not null,
  approved_at timestamptz,
  approved_by text references public.employees(id),
  check ((status = 'AWAITING_ALLOCATION' and final_allocation is null) or
         (status = 'ALLOCATED' and final_allocation = 'OVERHEAD' and approved_at is null and approved_by is null) or
         (status = 'ALLOCATED' and final_allocation is not null and approved_at is not null and approved_by = 'svetlana'))
);

create table public.manager_decisions (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null unique references public.transactions(id) on delete cascade,
  manager_id text not null references public.employees(id) check (manager_id = 'svetlana'),
  original_proposal jsonb not null,
  final_decision jsonb not null,
  created_at timestamptz not null default now()
);
create table public.commission_calculations (
  id uuid primary key default gen_random_uuid(),
  sale_transaction_id uuid not null unique references public.sales(transaction_id) on delete cascade,
  person_id text not null references public.employees(id) check (person_id in ('richard','anastasia','jean-claude')),
  final_basis_points integer not null check (final_basis_points between 0 and 10000),
  amount_cents bigint not null check (amount_cents >= 0),
  unique (sale_transaction_id, person_id)
);
create table public.google_sheets_sync_attempts (
  id uuid primary key default gen_random_uuid(), transaction_id uuid not null references public.transactions(id) on delete cascade,
  status text not null check (status in ('PENDING','SUCCEEDED','FAILED')), error text, attempted_at timestamptz not null default now()
);
create table public.telegram_notification_attempts (
  id uuid primary key default gen_random_uuid(), transaction_id uuid not null references public.transactions(id) on delete cascade,
  status text not null check (status in ('PENDING','SENT','FAILED','NO_RECIPIENT')), error text, attempted_at timestamptz not null default now()
);

-- Browser clients have no table privileges. Only server-side RPC using the service role mutates this ledger.
alter table public.employees enable row level security;
alter table public.telegram_employee_links enable row level security;
alter table public.transactions enable row level security;
alter table public.sales enable row level security;
alter table public.expenses enable row level security;
alter table public.manager_decisions enable row level security;
alter table public.commission_calculations enable row level security;
alter table public.google_sheets_sync_attempts enable row level security;
alter table public.telegram_notification_attempts enable row level security;

-- RPC functions are added in the next migration; each locks the transaction row and is idempotent on repeat approval.
