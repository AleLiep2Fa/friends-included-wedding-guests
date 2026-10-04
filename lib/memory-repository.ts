import { randomUUID } from "node:crypto";
import { calculateCommission } from "@/lib/rules";
import { employees, type AppState, type CommissionSplit, type Employee, type EmployeeId, type Expense, type ExpenseAllocation, type NotificationAttempt, type NotificationState, type Sale, type SyncAttempt, type SyncState, type TransactionSource } from "@/lib/domain";
import type { ExpenseInput, SaleInput, TransactionRepository } from "@/lib/repository";

const now = () => new Date().toISOString();

/** Test-only repository. Production routes construct SupabaseRepository and never persist browser state. */
export class MemoryRepository implements TransactionRepository {
  private sales = new Map<string, Sale>();
  private expenses = new Map<string, Expense>();
  private links = new Map<EmployeeId, { userId: string; chatId: string }>();
  private syncAttempts: SyncAttempt[] = [];
  private notificationAttempts: NotificationAttempt[] = [];

  async getEmployee(id: string): Promise<Employee | null> { return employees.find((employee) => employee.id === id) ?? null; }
  async getEmployeeByTelegramUserId(telegramUserId: string) {
    const hit = [...this.links.entries()].find(([, link]) => link.userId === telegramUserId);
    if (!hit) return null;
    return { employee: employees.find((employee) => employee.id === hit[0])!, chatId: hit[1].chatId };
  }
  async getEmployeeChatId(employeeId: EmployeeId) { return this.links.get(employeeId)?.chatId ?? null; }
  async linkTelegramEmployee(managerId: EmployeeId, telegramUserId: string, chatId: string, employeeId: EmployeeId) {
    if (managerId !== "svetlana") throw new Error("Only Svetlana may link Telegram users.");
    for (const [id, link] of this.links) if (link.userId === telegramUserId && id !== employeeId) this.links.delete(id);
    this.links.set(employeeId, { userId: telegramUserId, chatId });
  }
  private assertUnique(reference: string) {
    if (this.sales.has(reference) || this.expenses.has(reference)) throw new Error(`Reference ${reference} already exists.`);
  }
  async submitSale(actorId: EmployeeId, source: TransactionSource, chatId: string | null, input: SaleInput) {
    this.assertUnique(input.reference);
    const sale: Sale = {
      id: randomUUID(), type: "SALE", reference: input.reference, source, submitterId: actorId, originatingChatId: chatId, createdAt: now(),
      syncState: "PENDING", notificationState: "NOT_REQUIRED", customer: input.customer, project: input.project, description: input.description,
      amountCents: input.amountCents, status: "PENDING_APPROVAL", proposedSplit: input.proposedSplit, finalSplit: null, commissionPoolCents: 0,
      commissionAmounts: { richard: 0, anastasia: 0, jeanClaude: 0 }, approvedAt: null, approvedBy: null,
    };
    this.sales.set(sale.reference, sale); return sale;
  }
  async submitExpense(actorId: EmployeeId, source: TransactionSource, chatId: string | null, input: ExpenseInput) {
    this.assertUnique(input.reference);
    const automaticallyAllocated = input.proposedAllocation === "OVERHEAD";
    const expense: Expense = {
      id: randomUUID(), type: "EXPENSE", reference: input.reference, source, submitterId: actorId, originatingChatId: chatId, createdAt: now(),
      syncState: "PENDING", notificationState: "NOT_REQUIRED", description: input.description, category: input.category, amountCents: input.amountCents,
      proposedAllocation: input.proposedAllocation, finalAllocation: automaticallyAllocated ? "OVERHEAD" : null,
      status: automaticallyAllocated ? "ALLOCATED" : "AWAITING_ALLOCATION", approvedAt: null, approvedBy: null,
    };
    this.expenses.set(expense.reference, expense); return expense;
  }
  async approveSale(managerId: EmployeeId, reference: string, finalSplit: CommissionSplit) {
    const sale = this.sales.get(reference); if (!sale) throw new Error("Sale not found.");
    if (sale.status === "APPROVED") return { sale, changed: false };
    const commission = calculateCommission(sale.amountCents, finalSplit);
    const approved: Sale = { ...sale, status: "APPROVED", finalSplit, commissionPoolCents: commission.poolCents, commissionAmounts: commission.amounts, approvedAt: now(), approvedBy: managerId, syncState: "PENDING", notificationState: "PENDING" };
    this.sales.set(reference, approved); return { sale: approved, changed: true };
  }
  async approveExpense(managerId: EmployeeId, reference: string, finalAllocation: ExpenseAllocation) {
    const expense = this.expenses.get(reference); if (!expense) throw new Error("Expense not found.");
    if (expense.status === "ALLOCATED") return { expense, changed: false };
    const approved: Expense = { ...expense, status: "ALLOCATED", finalAllocation, approvedAt: now(), approvedBy: managerId, syncState: "PENDING", notificationState: "PENDING" };
    this.expenses.set(reference, approved); return { expense: approved, changed: true };
  }
  async getRecord(reference: string) { return this.sales.get(reference) ?? this.expenses.get(reference) ?? null; }
  async getState(): Promise<AppState> {
    return {
      employees: [...employees], sales: [...this.sales.values()], expenses: [...this.expenses.values()],
      telegramLinks: Object.fromEntries(employees.map((employee) => [employee.id, this.links.get(employee.id)?.chatId ?? null])) as AppState["telegramLinks"],
      syncAttempts: [...this.syncAttempts], notificationAttempts: [...this.notificationAttempts],
    };
  }
  async recordSync(reference: string, state: SyncState, attempt: SyncAttempt) {
    const record = await this.getRecord(reference); if (!record) throw new Error("Record not found.");
    Object.assign(record, { syncState: state }); this.syncAttempts.push(attempt);
  }
  async recordNotification(reference: string, state: NotificationState, attempt: NotificationAttempt) {
    const record = await this.getRecord(reference); if (!record) throw new Error("Record not found.");
    Object.assign(record, { notificationState: state }); this.notificationAttempts.push(attempt);
  }
}
