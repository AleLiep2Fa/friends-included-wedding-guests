# External live-test checklist

This checklist is intentionally not an authorization to perform any action. It records the exact work that remains after the local implementation and tests pass.

## Google Sheets: prerequisites already prepared

- Google Sheets API is enabled in `double-archive-510611-d0`.
- The target spreadsheet has exactly `Sales` and `Expenses` tabs.
- `friends-included-sheets-sync@double-archive-510611-d0.iam.gserviceaccount.com` is an Editor.
- The share link is Viewer-only for anyone with the link.
- The private key exists only as a local download and has not been added to this repository.

## Google Sheets: remaining authorized-live test

1. Set `GOOGLE_SHEETS_SPREADSHEET_ID` and `GOOGLE_SERVICE_ACCOUNT_JSON` as server-side local or Vercel secrets; do not paste the JSON in chat or source code.
2. Create the required temporary `SYNC-CHECK-001` sale through the running application and confirm that `Sales!A1:Q1` contains the required headers and the new reference appears on row 2. The defined control-reference pattern is deliberately supported by the shared validation and database constraint.
3. Approve or correct that same sale and confirm that the same reference row changes rather than a second row appearing.
4. Create an expense and confirm the equivalent behavior in `Expenses`.
5. Temporarily make a non-destructive Sheets failure only if separately approved, then use the manager retry and confirm the financial totals stay unchanged while the existing row updates.

## Telegram: remaining authorized-live test

1. Create a BotFather bot and keep its token in a server-side secret.
2. Set `TELEGRAM_BOT_TOKEN`, a high-entropy `TELEGRAM_WEBHOOK_SECRET`, and `TELEGRAM_LIVE_ENABLED=true` only for the approved test window.
3. Deploy the app, register `https://YOUR-VERCEL-URL/api/telegram/webhook` with Telegram using the same secret token, and have the test account send `/start` to the bot.
4. In the manager UI, link the test account to Richard and submit S01 from Telegram. Confirm the saved reference, amount, project, proposed split, and pending status reply.
5. Approve S01 as Svetlana. Confirm the return message contains the final split, individual EUR commissions, total commission, and whether the split changed.
6. Re-link that same Telegram account to Kevin, submit E01, allocate it as Svetlana, and confirm the allocation reply still returns to the original saved chat ID.
7. Verify unlinked-user rejection, invalid-command guidance, independent notification state, and manager retry behavior. Do not mark Telegram live-tested until all observations succeed.
