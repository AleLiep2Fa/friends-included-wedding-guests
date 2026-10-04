# Friends Included Ltd Wedding Guests for Hire

Vercel-ready Next.js application for the Day 4 homework. Supabase is the source of truth; Google Sheets is an automatic read-only copy of those records. Telegram and website submissions call the same server-side `TransactionService`.

## What is implemented locally

- Role-validated sales, paid-expense, approval, commission, allocation, retry, and financial-result rules.
- Supabase schema, Postgres RPCs, row-level security, and a migration-seeded five-person fictional workforce.
- Website forms, manager decisions, full record view, dashboard, and manager-only Telegram-link setup.
- Telegram webhook and `sendMessage` integration, with originating chat retention.
- Google Sheets API upsert integration for exactly `Sales` and `Expenses` tabs.
- Automated tests that execute the shared engine against every Test 1 and Test 2 record, rejection, rounding, retry, and persistence behavior.

## Local setup

1. Install dependencies with `pnpm install`.
2. Copy `.env.example` to `.env.local`. Keep all values server-side; never put service-role, Google, or Telegram secrets in `NEXT_PUBLIC_*` variables.
3. In Supabase SQL Editor or the Supabase CLI, apply `supabase/migrations/202610040001_friends_included.sql` followed by `202610040002_transaction_rpcs.sql`.
4. Run `pnpm dev`, then open `http://localhost:3000`.

The site intentionally shows a precise configuration error instead of silently using fake browser storage if Supabase is not configured. The in-memory repository exists only for automated unit tests.

## Quality checks

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Supabase configuration

Create a Supabase project only after authorization, then add these server-side Vercel/local variables:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

Apply the migrations before opening the application. Browser clients receive no database table privileges; application mutations go through server-only API routes and Postgres RPC functions. Do not expose the service-role key.

## Telegram: implemented locally; live setup deliberately pending

The webhook, server-side command parser, notification sender, retry-state handling, chat-ID preservation, and role checks are implemented. No bot, webhook, token, or message has been created or used. The route fails closed with `503` until all three server-only Telegram settings exist and live delivery is deliberately enabled; an invalid webhook-secret header receives `401` before any ledger work begins.

When separately authorized to configure and test Telegram, use this exact sequence:

1. In Telegram, use BotFather's `/newbot` flow. Keep the resulting token in a secret manager or server environment only.
2. Deploy the application first, then set these server-side variables in the hosting environment (never use a `NEXT_PUBLIC_*` name):

   ```text
   TELEGRAM_BOT_TOKEN=<BotFather token>
   TELEGRAM_WEBHOOK_SECRET=<new random high-entropy value>
   TELEGRAM_LIVE_ENABLED=false
   ```

3. Have each intended recipient open a private chat with the bot and send `/start`; this lets Telegram deliver replies to that chat.
4. In Svetlana's manager screen, link the recipient's numeric Telegram user ID and chat ID to the appropriate fictional employee. The bot never creates or self-assigns those links.
5. When live testing is explicitly approved, enable delivery and register the webhook using the same secret:

   ```text
   curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
     -d "url=https://YOUR-VERCEL-URL/api/telegram/webhook" \
     -d "secret_token=${TELEGRAM_WEBHOOK_SECRET}"
   ```

6. Run S01 as Richard, approve it as Svetlana, then re-link the same Telegram account to Kevin and run E01. Confirm that both return notifications go to the original saved chat ID and that the record displays the independent notification state.

The accepted command formats are:

Accepted bot commands are:

```text
/sale S01|Olivia Rose|A|One proud uncle and an emotional grandmother|1000.00|50|30|20
/expense E01|Rented suit and fake pearl necklace for the relatives|MATERIALS|120.00|A
```

Descriptions may contain spaces, but `|` remains the field delimiter. Unlinked users are rejected with guidance; malformed or invalid submissions receive a corrective reply and do not save a transaction.

## Google Sheets: secure server configuration and live-sync checklist

The required two-tab spreadsheet, enabled Google Sheets API, and restricted sync service account are already prepared. The service account is Editor; the public worksheet link is Viewer-only. The application does not read a JSON key from source control, the browser, or a public variable.

To configure the server after explicit authorization:

1. Put the spreadsheet ID in a server-only environment variable. For the prepared workbook, use `1j0NvvFbBY_7O0PX49T-7i2ZyJGguugjHxqyNFRPcZdU`.
2. Store the downloaded service-account JSON in a secret manager or ignored `.env.local` file as one JSON line in `GOOGLE_SERVICE_ACCOUNT_JSON`. Do not commit, paste into chat, add to documentation, or set it as `NEXT_PUBLIC_*`.
3. Optionally set `NEXT_PUBLIC_GOOGLE_SHEETS_URL` to the Viewer link so the website shows the public copy. That URL is not a credential.
4. Start the app. Configuration is checked only when a sync is requested: missing or malformed values become a clear `NOT_CONFIGURED` state rather than a startup failure or accidental network request.

On the first authorized real sync, the server verifies that exactly `Sales` and `Expenses` exist, writes the required header row to row 1 if it is empty, and writes the first transaction to row 2. Later submissions, approvals, and retries update the existing reference row rather than appending a duplicate. A remote API failure is recorded separately and never rolls back the saved financial transaction.

The remaining live verification steps are documented in [the external live-test checklist](docs/external-live-test-checklist.md). They have not been run.

## Vercel configuration and release sequence

1. Create a private GitHub repository and push this project without `.env.local` or credentials.
2. Import it into Vercel, add all server-side environment variables, and set the three optional public links once their destinations exist.
3. Deploy, apply a real Telegram webhook, and execute the live S01/E01 flow after authorization.
4. Complete Test 1, then Test 2 through the website. Confirm the dashboard persists after a refresh and the configured Sheet shows the same references.
5. Only then place the Vercel URL in the user's own course-spreadsheet row. Do not edit any other row.

## Instructor testing flow

Use the `Demonstration role` selector to act as the fictional employees. Salespeople can submit only sales; Kevin can submit only expenses; only Svetlana can approve or correct decisions. The manager view exposes retries and Telegram links. Test 1 and Test 2 inputs and correct figures are in the supplied homework brief and are exercised in `tests/transaction-service.test.ts`.
