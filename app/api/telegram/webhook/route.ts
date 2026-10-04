import { NextResponse } from "next/server";
import { service } from "@/lib/server";
import { parseTelegramCommand, telegramUsage } from "@/lib/telegram-command";
import { sendTelegramMessage } from "@/lib/telegram";
import { telegramWebhookEnabled } from "@/lib/telegram-config";
import { validateExpenseInput, validateSaleInput } from "@/lib/validation";

type TelegramUpdate = { message?: { text?: string; from?: { id?: number }; chat?: { id?: number } } };

async function reply(chatId: number, text: string) {
  await sendTelegramMessage(String(chatId), text);
}

function messageFor(error: unknown) {
  const detail = error instanceof Error ? error.message : "The transaction could not be saved.";
  return `Not saved: ${detail} ${telegramUsage}`;
}

export async function POST(request: Request) {
  if (!telegramWebhookEnabled()) return NextResponse.json({ error: "Telegram webhook is disabled or not configured." }, { status: 503 });
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET!;
  if (request.headers.get("x-telegram-bot-api-secret-token") !== secret) return NextResponse.json({ error: "Invalid webhook secret." }, { status: 401 });

  let update: TelegramUpdate;
  try { update = await request.json() as TelegramUpdate; } catch { return NextResponse.json({ error: "Expected a Telegram update JSON object." }, { status: 400 }); }
  const message = update.message; const userId = message?.from?.id; const chatId = message?.chat?.id; const text = message?.text?.trim();
  if (!userId || !chatId || !text) return NextResponse.json({ ok: true });

  const { repo, transactions } = service();
  const linked = await repo.getEmployeeByTelegramUserId(String(userId));
  if (!linked) { await reply(chatId, "Your Telegram account is not linked to a fictional employee. Ask Svetlana to link it in the manager screen."); return NextResponse.json({ ok: true }); }

  const command = parseTelegramCommand(text);
  if (command.kind === "INVALID") { await reply(chatId, command.error); return NextResponse.json({ ok: true }); }
  try {
    if (command.kind === "SALE") await transactions.submitSale(linked.employee.id, "TELEGRAM", String(chatId), validateSaleInput(command.input));
    else await transactions.submitExpense(linked.employee.id, "TELEGRAM", String(chatId), validateExpenseInput(command.input));
  } catch (error) { await reply(chatId, messageFor(error)); }
  return NextResponse.json({ ok: true });
}
