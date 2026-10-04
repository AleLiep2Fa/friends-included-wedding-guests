import { NextResponse } from "next/server";
import { telegramWebhookEnabled } from "@/lib/telegram-config";

const publicApplicationUrl = "https://friends-included-wedding-guests.vercel.app";

/**
 * One-time operational endpoint used only to register this deployment's fixed
 * Telegram callback. It accepts no destination or credential from callers:
 * both remain server-side Vercel secrets. Remove after a successful setup.
 */
export async function POST() {
  if (!telegramWebhookEnabled()) {
    return NextResponse.json({ error: "Telegram webhook is disabled or not configured." }, { status: 503 });
  }

  const webhookUrl = `${publicApplicationUrl}/api/telegram/webhook`;
  const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/setWebhook`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: webhookUrl, secret_token: process.env.TELEGRAM_WEBHOOK_SECRET, allowed_updates: ["message"], drop_pending_updates: false }),
  });
  const payload = await response.json().catch(() => null) as { ok?: boolean; description?: string } | null;

  if (!response.ok || !payload?.ok) {
    return NextResponse.json({ error: payload?.description ?? `Telegram returned HTTP ${response.status}.` }, { status: 502 });
  }
  return NextResponse.json({ ok: true, webhookUrl });
}
