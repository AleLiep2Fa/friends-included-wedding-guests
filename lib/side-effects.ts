import "server-only";
import type { Expense, Sale } from "@/lib/domain";
import { syncToGoogleSheets } from "@/lib/google-sheets";
import type { TransactionRepository } from "@/lib/repository";
import type { DeliveryResult, SideEffects } from "@/lib/transaction-service";
import { sendDecisionNotification, sendSubmissionConfirmation } from "@/lib/telegram";

function delivery(kind: "SENT" | "SYNCED" | "NO_RECIPIENT" | "NOT_CONFIGURED", error?: string): DeliveryResult { return { state: kind, error }; }

export function productionSideEffects(repo: TransactionRepository): SideEffects {
  return {
    async sync(record: Sale | Expense) { const result = await syncToGoogleSheets(record); return result.configured ? delivery("SYNCED") : delivery("NOT_CONFIGURED", result.error); },
    async submissionConfirmation(record: Sale | Expense) { const result = await sendSubmissionConfirmation(record, repo); return delivery(result.kind, result.error); },
    async decisionNotification(record: Sale | Expense) { const result = await sendDecisionNotification(record, repo); return delivery(result.kind, result.error); },
  };
}
