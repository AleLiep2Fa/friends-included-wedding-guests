# Implementation status

## Current milestone

External setup is partially complete. The healthy Supabase project `friends-included-wedding-guests` in Frankfurt has both database migrations applied. Google Sheets API is enabled in the Google Cloud project `Friends Included Finance` (`double-archive-510611-d0`). The spreadsheet has exactly `Sales` and `Expenses` tabs; its dedicated sync service account has Editor access, while anyone with the link has Viewer access.

## Key decisions

- Money is stored and calculated as integer cents. Percentage shares are stored as integer basis points, so 100% is exactly 10,000.
- The `transactions` ledger owns the unique reference across sales and expenses. Detail tables retain the transaction-specific data.
- The server-side `TransactionService` is the only rules engine. Both website routes and Telegram webhook call it.
- Supabase RPCs make production submission/approval database operations atomic. The in-memory repository is test-only and never a browser fallback.
- Google Sheets and Telegram are best-effort side effects with separate attempt histories. A failed side effect never rolls back financial approval.

## Completed local checks

- `pnpm test` passed: 13 automated tests, including exact Test 1 and Test 2 input records, Telegram parser/gate coverage, and Sheets configuration/upsert regression coverage.
- `pnpm lint` passed with zero warnings.
- `pnpm typecheck` passed.
- `pnpm build` passed after the integration hardening. The production route report includes `/` and the five dynamic API routes.
- The tests cover commission rounding/tie break, invalid split, role denial, duplicate reference, zero amount, idempotent approval, Sheets retry, Telegram failure, and reload-persistence behavior.
- Local Telegram and Sheets hardening added: command parsing preserves descriptions with spaces, disabled/unconfigured webhooks fail closed before ledger access, Google credentials are validated without a network call, and a first Sheets sync reserves row 1 for headers and writes its first record to row 2.
- `pnpm test` now passes 13 tests, including Telegram parser/gate, Sheets configuration, and Sheets upsert-row regression coverage. `pnpm lint`, `pnpm typecheck`, and `pnpm build` all pass after the integration changes.
- Supabase migration `202610040001_friends_included.sql` succeeded: schema, ledger tables, security settings, and five fictional employee records were created.
- Supabase migration `202610040002_transaction_rpcs.sql` succeeded: atomic submission/approval RPCs and browser-role privilege revocations were created.
- A read-only Supabase smoke query returned 5 employees, 3 core finance tables (`transactions`, `sales`, `expenses`), and 4 transaction RPCs (`submit_sale`, `submit_expense`, `approve_sale`, `approve_expense`).
- Google Sheets API is enabled. The `friends-included-sheets-sync` service account was created, its JSON private key was saved locally without being exposed in this project, and it was granted Editor access to the configured spreadsheet.
- The spreadsheet's public link setting is `Anyone with the link — Viewer`; the service account remains the sole non-owner editor used by the app.

## Known external limitations

- The Supabase schema is live. Its server-only service-role key must be configured locally and later in Vercel; do not place that key in source control or share it in chat.
- Telegram is intentionally unconfigured and disabled: no bot exists, no webhook is registered, no token is configured, and no real message has been sent. Live S01/E01 confirmation/return-notification verification remains pending explicit authorization.
- Google Sheets cloud resources and spreadsheet access are ready. The application now validates server-side credentials and upsert behavior locally, but the downloaded service-account key and spreadsheet ID have not been inserted into a local/Vercel environment. A real submission/approval sync remains untested.
- There is no GitHub repository, Vercel deployment, public URL, or course-spreadsheet submission.

## Next action after local checks

Next: after separate authorization, securely configure Supabase and Google Sheets server-side values, authorize a live Sheets synchronization test, configure Telegram credentials and authorize live bot checks, then publish and submit.
