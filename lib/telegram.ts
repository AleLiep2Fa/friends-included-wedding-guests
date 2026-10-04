import "server-only";
import type { Expense, Sale } from "@/lib/domain";
import { employees } from "@/lib/domain";
import { formatEuro, formatPercentage } from "@/lib/money";
import { saleSplitChanged } from "@/lib/rules";
import type { TransactionRepository } from "@/lib/repository";
import { telegramDeliveryEnabled } from "@/lib/telegram-config";
function employeeName(id: string) { return employees.find((employee) => employee.id === id)?.name ?? id; }

async function recipient(record: Sale | Expense, repo: TransactionRepository): Promise<string | null> {
  return record.originatingChatId ?? repo.getEmployeeChatId(record.submitterId);
}
export async function sendTelegramMessage(chatId: string, text: string) {
  if (!telegramDeliveryEnabled()) return { sent: false, notConfigured: true, error: "Telegram live delivery is disabled or not configured." };
  const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text }) });
  const json = await response.json().catch(() => null) as { ok?: boolean; description?: string } | null;
  if (!response.ok || !json?.ok) throw new Error(json?.description ?? `Telegram returned HTTP ${response.status}.`);
  return { sent: true, notConfigured: false };
}

function confirmation(record: Sale | Expense) {
  return record.type === "SALE"
    ? `Saved ${record.reference}. Sale ${formatEuro(record.amountCents)} for Project ${record.project}; proposed split Richard ${formatPercentage(record.proposedSplit.richard)}, Anastasia ${formatPercentage(record.proposedSplit.anastasia)}, Jean-Claude ${formatPercentage(record.proposedSplit.jeanClaude)}. Current status: Pending approval.`
    : `Saved ${record.reference}. Expense ${formatEuro(record.amountCents)}; proposed allocation ${record.proposedAllocation}. Current status: ${record.status === "AWAITING_ALLOCATION" ? "Awaiting allocation" : "Allocated company overhead"}.`;
}
function decision(record: Sale | Expense) {
  if (record.type === "SALE") {
    const final = record.finalSplit!;
    return `Sale ${record.reference} approved${saleSplitChanged(record) ? " — commission split changed" : ""}. Sale ${formatEuro(record.amountCents)}; total commission ${formatEuro(record.commissionPoolCents)}. Richard: ${formatPercentage(final.richard)} (${formatEuro(record.commissionAmounts.richard)}). Anastasia: ${formatPercentage(final.anastasia)} (${formatEuro(record.commissionAmounts.anastasia)}). Jean-Claude: ${formatPercentage(final.jeanClaude)} (${formatEuro(record.commissionAmounts.jeanClaude)}).`;
  }
  return `Expense ${record.reference} allocation confirmed${record.proposedAllocation !== record.finalAllocation ? " — allocation changed" : ""}. ${formatEuro(record.amountCents)}: ${record.description}. Proposed: ${record.proposedAllocation}. Approved: ${record.finalAllocation}.`;
}

export async function sendSubmissionConfirmation(record: Sale | Expense, repo: TransactionRepository) {
  const chatId = await recipient(record, repo); if (!chatId) return { kind: "NO_RECIPIENT" as const, error: "No Telegram recipient linked." };
  const result = await sendTelegramMessage(chatId, confirmation(record)); return result.sent ? { kind: "SENT" as const } : { kind: "NOT_CONFIGURED" as const, error: result.error };
}
export async function sendDecisionNotification(record: Sale | Expense, repo: TransactionRepository) {
  const chatId = await recipient(record, repo); if (!chatId) return { kind: "NO_RECIPIENT" as const, error: `No Telegram recipient linked for ${employeeName(record.submitterId)}.` };
  const result = await sendTelegramMessage(chatId, decision(record)); return result.sent ? { kind: "SENT" as const } : { kind: "NOT_CONFIGURED" as const, error: result.error };
}
