type Environment = Readonly<Record<string, string | undefined>>;

export function telegramDeliveryEnabled(env: Environment = process.env) {
  return env.TELEGRAM_LIVE_ENABLED === "true" && Boolean(env.TELEGRAM_BOT_TOKEN);
}

export function telegramWebhookEnabled(env: Environment = process.env) {
  return telegramDeliveryEnabled(env) && Boolean(env.TELEGRAM_WEBHOOK_SECRET);
}
