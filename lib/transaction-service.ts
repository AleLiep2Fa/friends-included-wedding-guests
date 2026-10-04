import type { CommissionSplit, Employee, EmployeeId, Expense, ExpenseAllocation, Sale, TransactionSource } from "@/lib/domain";
import type { ExpenseInput, SaleInput, TransactionRepository } from "@/lib/repository";
import { validateCommissionSplit } from "@/lib/rules";

export type DeliveryResult = { state: "SENT" | "SYNCED" | "NO_RECIPIENT" | "NOT_CONFIGURED"; error?: string };
export interface SideEffects {
  sync(record: Sale | Expense): Promise<DeliveryResult>;
  submissionConfirmation(record: Sale | Expense): Promise<DeliveryResult>;
  decisionNotification(record: Sale | Expense): Promise<DeliveryResult>;
}
const timestamp = () => new Date().toISOString();

export class TransactionService {
  constructor(private readonly repo: TransactionRepository, private readonly sideEffects: SideEffects) {}
  private async actor(actorId: string): Promise<Employee> { const actor = await this.repo.getEmployee(actorId); if (!actor) throw new Error("Unknown demonstration actor."); return actor; }
  private async requireRole(actorId: string, role: Employee["role"]): Promise<Employee> { const actor = await this.actor(actorId); if (actor.role !== role) throw new Error("This fictional role is not permitted to perform that action."); return actor; }
  private validateReference(reference: string) { if (!/^[A-Z][0-9]{2,}$/u.test(reference)) throw new Error("Use a reference such as S01 or E07."); }
  private validateSale(input: SaleInput) {
    this.validateReference(input.reference);
    if (!input.customer.trim() || !input.description.trim()) throw new Error("Customer and description are required.");
    if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) throw new Error("Amount must be greater than zero cents.");
    validateCommissionSplit(input.proposedSplit);
  }
  private validateExpense(input: ExpenseInput) {
    this.validateReference(input.reference);
    if (!input.description.trim()) throw new Error("Expense description is required.");
    if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) throw new Error("Amount must be greater than zero cents.");
  }
  async submitSale(actorId: string, source: TransactionSource, chatId: string | null, input: SaleInput) {
    const actor = await this.requireRole(actorId, "SALESPERSON"); this.validateSale(input);
    const sale = await this.repo.submitSale(actor.id, source, chatId, input); await this.sync(sale); if (source === "TELEGRAM") await this.confirmSubmission(sale); return sale;
  }
  async submitExpense(actorId: string, source: TransactionSource, chatId: string | null, input: ExpenseInput) {
    const actor = await this.requireRole(actorId, "EXPENSE_REPORTER"); this.validateExpense(input);
    const expense = await this.repo.submitExpense(actor.id, source, chatId, input); await this.sync(expense); if (source === "TELEGRAM") await this.confirmSubmission(expense); return expense;
  }
  async approveSale(actorId: string, reference: string, split: CommissionSplit) {
    const manager = await this.requireRole(actorId, "MANAGER"); validateCommissionSplit(split);
    const result = await this.repo.approveSale(manager.id, reference, split); if (result.changed) { await this.sync(result.sale); await this.notifyDecision(result.sale); } return result;
  }
  async approveExpense(actorId: string, reference: string, allocation: ExpenseAllocation) {
    const manager = await this.requireRole(actorId, "MANAGER");
    const result = await this.repo.approveExpense(manager.id, reference, allocation); if (result.changed) { await this.sync(result.expense); await this.notifyDecision(result.expense); } return result;
  }
  async linkTelegramEmployee(actorId: string, telegramUserId: string, chatId: string, employeeId: EmployeeId) {
    const manager = await this.requireRole(actorId, "MANAGER");
    if (!/^\d+$/.test(telegramUserId) || !/^[-\d]+$/.test(chatId)) throw new Error("Telegram user ID and chat ID must be numeric.");
    await this.repo.linkTelegramEmployee(manager.id, telegramUserId, chatId, employeeId);
  }
  async retrySync(actorId: string, reference: string) { await this.requireRole(actorId, "MANAGER"); const record = await this.repo.getRecord(reference); if (!record) throw new Error("Transaction not found."); await this.sync(record); }
  async retryNotification(actorId: string, reference: string) { await this.requireRole(actorId, "MANAGER"); const record = await this.repo.getRecord(reference); if (!record) throw new Error("Transaction not found."); await this.notifyDecision(record); }
  private async sync(record: Sale | Expense) {
    try { const result = await this.sideEffects.sync(record); const state = result.state === "SYNCED" ? "SYNCED" : result.state === "NOT_CONFIGURED" ? "NOT_CONFIGURED" : "FAILED"; await this.repo.recordSync(record.reference, state, { reference: record.reference, status: state === "SYNCED" ? "SUCCEEDED" : "FAILED", error: result.error ?? null, attemptedAt: timestamp() }); }
    catch (error) { await this.repo.recordSync(record.reference, "FAILED", { reference: record.reference, status: "FAILED", error: error instanceof Error ? error.message : "Unknown Sheets error", attemptedAt: timestamp() }); }
  }
  private async confirmSubmission(record: Sale | Expense) { await this.applyNotification(record, "submissionConfirmation"); }
  private async notifyDecision(record: Sale | Expense) { await this.applyNotification(record, "decisionNotification"); }
  private async applyNotification(record: Sale | Expense, action: "submissionConfirmation" | "decisionNotification") {
    try { const result = await this.sideEffects[action](record); const state = result.state === "SENT" ? "SENT" : result.state === "NO_RECIPIENT" ? "NO_RECIPIENT" : result.state === "NOT_CONFIGURED" ? "NOT_CONFIGURED" : "FAILED"; await this.repo.recordNotification(record.reference, state, { reference: record.reference, status: state === "SENT" ? "SENT" : state === "NO_RECIPIENT" ? "NO_RECIPIENT" : "FAILED", error: result.error ?? null, attemptedAt: timestamp() }); }
    catch (error) { await this.repo.recordNotification(record.reference, "FAILED", { reference: record.reference, status: "FAILED", error: error instanceof Error ? error.message : "Unknown Telegram error", attemptedAt: timestamp() }); }
  }
}
