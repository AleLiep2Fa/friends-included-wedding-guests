import type { AppState, CommissionSplit, Employee, EmployeeId, Expense, ExpenseAllocation, NotificationAttempt, NotificationState, Sale, SyncAttempt, SyncState, TransactionSource } from "@/lib/domain";

export interface SaleInput {
  reference: string;
  customer: string;
  project: "A" | "B";
  description: string;
  amountCents: number;
  proposedSplit: CommissionSplit;
}

export interface ExpenseInput {
  reference: string;
  description: string;
  category: "MATERIALS" | "TRAVEL" | "OTHER";
  amountCents: number;
  proposedAllocation: ExpenseAllocation;
}

export interface TransactionRepository {
  getEmployee(id: string): Promise<Employee | null>;
  getEmployeeByTelegramUserId(telegramUserId: string): Promise<{ employee: Employee; chatId: string } | null>;
  getEmployeeChatId(employeeId: EmployeeId): Promise<string | null>;
  linkTelegramEmployee(managerId: EmployeeId, telegramUserId: string, chatId: string, employeeId: EmployeeId): Promise<void>;
  submitSale(actorId: EmployeeId, source: TransactionSource, chatId: string | null, input: SaleInput): Promise<Sale>;
  submitExpense(actorId: EmployeeId, source: TransactionSource, chatId: string | null, input: ExpenseInput): Promise<Expense>;
  approveSale(managerId: EmployeeId, reference: string, finalSplit: CommissionSplit): Promise<{ sale: Sale; changed: boolean }>;
  approveExpense(managerId: EmployeeId, reference: string, finalAllocation: ExpenseAllocation): Promise<{ expense: Expense; changed: boolean }>;
  getRecord(reference: string): Promise<Sale | Expense | null>;
  getState(): Promise<AppState>;
  recordSync(reference: string, state: SyncState, attempt: SyncAttempt): Promise<void>;
  recordNotification(reference: string, state: NotificationState, attempt: NotificationAttempt): Promise<void>;
}
