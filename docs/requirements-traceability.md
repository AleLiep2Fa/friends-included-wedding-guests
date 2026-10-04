# Homework requirements traceability

| Brief requirement | Implementation | Validation evidence | Status |
| --- | --- | --- | --- |
| Supabase is the sole source of truth; Sheets is view-only copy | `supabase/migrations/*`, `lib/supabase-repository.ts`; no browser persistence adapter | live schema verification: 5 seeded employees, 3 core finance tables, 4 RPCs; RLS and revoked browser privileges | Verified in Supabase; app credentials pending |
| Shared Telegram and website processing | `lib/transaction-service.ts`, website API routes, Telegram webhook route | shared-engine source tests plus 13-test local suite; Telegram command parsing is independently regression-tested | Verified locally |
| Five exact fictional employees and role selector | `lib/domain.ts`, `components/app-client.tsx` | type-checked UI and role tests | Verified locally |
| Server-side role enforcement and no duplicate references | `TransactionService`, SQL RPCs, unique `transactions.reference` | role/duplicate rejection test | Verified locally |
| Required temporary Sheets control record | shared validation, transaction constraint, and submission RPCs in migrations `202610040003` / `202610040004` | automated `SYNC-CHECK-001` submission test | Live constraint applied; RPC migration pending |
| Cents-safe money, 10% commission, exact 100% split, rounding tie break | `lib/money.ts`, `lib/rules.ts` | rounding/tie-break and invalid 60/30/20 test | Verified locally |
| Pending sales excluded; all expenses reduce company result; allocation rules | `calculateFinancialTotals`, expense creation/approval | lifecycle test and Test 1/Test 2 test | Verified locally |
| Original proposals and final decisions | proposal/final fields in `sales` and `expenses`, `manager_decisions` | record UI and SQL schema inspection | Implemented locally |
| Atomic submit/approve and idempotent approval | Postgres RPCs lock rows; service uses them | second approval test; 4 RPCs verified present in Supabase | Database functions deployed; live application flow pending credentials |
| Financial dashboard and persistent record view | `components/app-client.tsx`, `/api/state` | Test 1/Test 2 computation test; browser persistence requires configured Supabase | Implemented locally; live refresh pending |
| Telegram link rules, original chat retention, confirmations and decision messages | `telegram_employee_links`, `lib/telegram.ts`, `lib/telegram-command.ts`, webhook route | parser tests preserve spaced descriptions and reject malformed input; disabled/unconfigured webhook fails closed; Telegram failure-state test | Implemented locally; bot, credentials, webhook, and live test intentionally pending |
| Separate Telegram delivery status and idempotent retry | transaction state fields, `telegram_notification_attempts`, manager retry | failed-notification and retry/persistence test | Verified locally; live delivery pending |
| Sheets: exactly Sales/Expenses, readable required columns, upsert by reference | `lib/google-sheets.ts`, `lib/google-sheets-config.ts` | regression tests prove headers use row 1, first record uses row 2, and later references update rather than duplicate; actual two tabs/API/service-account access verified | Secure code and cloud setup complete; real API test pending secret configuration |
| Sheet failure leaves financial record unchanged | `TransactionService.sync` and state tracking | failed Sheets followed by retry test; malformed/missing credentials fail closed locally; configured two-tab Sheet with public Viewer link and dedicated Editor service account | Verified locally; live API pending secure configuration |
| Test 1 results €700 / €1,800 / €2,400 and commissions €90 / €110 / €100 | shared service + `calculateFinancialTotals` | Test 1 automated test | Verified locally |
| Test 2 cumulative results and S05/E07/reconciliation | shared service + `calculateFinancialTotals` | Test 2 automated test | Verified locally |
| Required rejected actions leave totals unchanged | validation, role guard, duplicate guard, idempotency | rejection and second-approval tests | Verified locally |
| Vercel page links, GitHub, Sheet, bot and completed test records | public environment link slots in UI | link slots reviewed | Implemented locally; external configuration and deployment pending |
| S01/E01 actual bot loop and course submission | live Telegram route and README flow | cannot run without user-authorized external accounts | Blocked by credentials, authorization, and later deployment |
