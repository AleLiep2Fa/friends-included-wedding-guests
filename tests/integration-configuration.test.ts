import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { googleSheetsConfiguration, googleSheetsUpsertPlan } from "@/lib/google-sheets-config";
import { parseTelegramCommand, telegramUsage } from "@/lib/telegram-command";
import { telegramDeliveryEnabled, telegramWebhookEnabled } from "@/lib/telegram-config";

describe("local integration safeguards", () => {
  it("preserves spaces in Telegram descriptions and accepts the standard bot-command suffix", () => {
    expect(parseTelegramCommand("/sale@FriendsIncludedBot S01|Olivia Rose|A|One proud uncle and an emotional grandmother|1000.00|50|30|20")).toEqual({
      kind: "SALE",
      input: { reference: "S01", customer: "Olivia Rose", project: "A", description: "One proud uncle and an emotional grandmother", amount: "1000.00", richard: "50", anastasia: "30", jeanClaude: "20" },
    });
    expect(parseTelegramCommand("/expense E01|Rented suit and fake pearl necklace|MATERIALS|120.00|A")).toMatchObject({ kind: "EXPENSE", input: { description: "Rented suit and fake pearl necklace" } });
  });

  it("rejects malformed Telegram commands before the shared transaction service is called", () => {
    expect(parseTelegramCommand("/sale S01|Olivia|A|Description|1000|50|50")).toEqual({ kind: "INVALID", error: expect.stringContaining("eight pipe-separated values") });
    expect(parseTelegramCommand("hello")).toEqual({ kind: "INVALID", error: telegramUsage });
  });

  it("plans header creation on row one and the first synchronized record on row two", () => {
    const headers = ["Reference", "Status"];
    expect(googleSheetsUpsertPlan([], headers, "S01")).toEqual({ writeHeaders: true, rowNumber: 2 });
    expect(googleSheetsUpsertPlan([headers], headers, "S01")).toEqual({ writeHeaders: false, rowNumber: 2 });
    expect(googleSheetsUpsertPlan([headers, ["S01", "PENDING_APPROVAL"], ["S02", "APPROVED"]], headers, "S01")).toEqual({ writeHeaders: false, rowNumber: 2 });
    expect(googleSheetsUpsertPlan([headers, ["S01", "PENDING_APPROVAL"]], headers, "S02")).toEqual({ writeHeaders: false, rowNumber: 3 });
    expect(() => googleSheetsUpsertPlan([["Reference", "Wrong label"]], headers, "S01")).toThrow("headers do not match");
  });

  it("fails closed locally when Google Sheets credentials are absent or malformed", () => {
    expect(googleSheetsConfiguration({})).toEqual({ configured: false, error: expect.stringContaining("GOOGLE_SHEETS_SPREADSHEET_ID") });
    expect(googleSheetsConfiguration({ GOOGLE_SHEETS_SPREADSHEET_ID: "spreadsheet-id", GOOGLE_SERVICE_ACCOUNT_JSON: "not-json" })).toEqual({ configured: false, error: "GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON." });
    expect(googleSheetsConfiguration({ GOOGLE_SHEETS_SPREADSHEET_ID: "spreadsheet-id", GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({ type: "service_account", client_email: "sync@example.test", private_key: "private-key" }) })).toMatchObject({ configured: true, spreadsheetId: "spreadsheet-id" });
  });

  it("keeps Telegram delivery and webhook processing disabled until every required server setting exists", () => {
    expect(telegramDeliveryEnabled({})).toBe(false);
    expect(telegramDeliveryEnabled({ TELEGRAM_LIVE_ENABLED: "true" })).toBe(false);
    expect(telegramWebhookEnabled({ TELEGRAM_LIVE_ENABLED: "true", TELEGRAM_BOT_TOKEN: "token" })).toBe(false);
    expect(telegramWebhookEnabled({ TELEGRAM_LIVE_ENABLED: "true", TELEGRAM_BOT_TOKEN: "token", TELEGRAM_WEBHOOK_SECRET: "secret" })).toBe(true);
  });

  it("keeps expense-submission CASE expressions typed as their database enums", () => {
    const migration = readFileSync(new URL("../supabase/migrations/202610040007_cast_expense_status.sql", import.meta.url), "utf8");
    expect(migration).toContain("'OVERHEAD'::public.expense_allocation");
    expect(migration).toContain("'ALLOCATED'::public.expense_status");
    expect(migration).toContain("'AWAITING_ALLOCATION'::public.expense_status");
  });
});
