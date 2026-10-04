export const employeeIds = ["svetlana", "richard", "anastasia", "jean-claude", "kevin"] as const;
export type EmployeeId = (typeof employeeIds)[number];
export type Role = "MANAGER" | "SALESPERSON" | "EXPENSE_REPORTER";
export type Project = "A" | "B";
export type ExpenseAllocation = Project | "OVERHEAD";
export type TransactionSource = "WEBSITE" | "TELEGRAM";
export type SyncState = "PENDING" | "SYNCED" | "FAILED" | "NOT_CONFIGURED";
export type NotificationState = "NOT_REQUIRED" | "PENDING" | "SENT" | "FAILED" | "NO_RECIPIENT" | "NOT_CONFIGURED";

export interface Employee {
  id: EmployeeId;
  name: string;
  role: Role;
}

export const employees: Employee[] = [
  { id: "svetlana", name: "Svetlana de Monte Carlo", role: "MANAGER" },
  { id: "richard", name: "Richard Darling", role: "SALESPERSON" },
  { id: "anastasia", name: "Anastasia Ferrari", role: "SALESPERSON" },
  { id: "jean-claude", name: "Jean-Claude Bērziņš", role: "SALESPERSON" },
  { id: "kevin", name: "Kevin von Whatever", role: "EXPENSE_REPORTER" },
];

export type CommissionPerson = "richard" | "anastasia" | "jeanClaude";
export const commissionPeople: CommissionPerson[] = ["richard", "anastasia", "jeanClaude"];
export type CommissionSplit = Record<CommissionPerson, number>; // basis points: 10,000 = 100%
export type CommissionAmounts = Record<CommissionPerson, number>; // integer cents

export interface BaseRecord {
  id: string;
  reference: string;
  source: TransactionSource;
  submitterId: EmployeeId;
  originatingChatId: string | null;
  createdAt: string;
  syncState: SyncState;
  notificationState: NotificationState;
}

export interface Sale extends BaseRecord {
  type: "SALE";
  customer: string;
  project: Project;
  description: string;
  amountCents: number;
  status: "PENDING_APPROVAL" | "APPROVED";
  proposedSplit: CommissionSplit;
  finalSplit: CommissionSplit | null;
  commissionPoolCents: number;
  commissionAmounts: CommissionAmounts;
  approvedAt: string | null;
  approvedBy: EmployeeId | null;
}

export interface Expense extends BaseRecord {
  type: "EXPENSE";
  description: string;
  category: "MATERIALS" | "TRAVEL" | "OTHER";
  amountCents: number;
  proposedAllocation: ExpenseAllocation;
  finalAllocation: ExpenseAllocation | null;
  status: "AWAITING_ALLOCATION" | "ALLOCATED";
  approvedAt: string | null;
  approvedBy: EmployeeId | null;
}

export interface SyncAttempt {
  reference: string;
  status: "PENDING" | "SUCCEEDED" | "FAILED";
  error: string | null;
  attemptedAt: string;
}

export interface NotificationAttempt {
  reference: string;
  status: "PENDING" | "SENT" | "FAILED" | "NO_RECIPIENT";
  error: string | null;
  attemptedAt: string;
}

export interface AppState {
  employees: Employee[];
  sales: Sale[];
  expenses: Expense[];
  telegramLinks: Record<EmployeeId, string | null>;
  syncAttempts: SyncAttempt[];
  notificationAttempts: NotificationAttempt[];
}

export interface ProjectTotals {
  approvedIncomeCents: number;
  commissionExpenseCents: number;
  allocatedExpenseCents: number;
  resultCents: number;
}

export interface FinancialTotals {
  projects: Record<Project, ProjectTotals>;
  approvedIncomeCents: number;
  commissionExpenseCents: number;
  companyOverheadCents: number;
  awaitingAllocationCents: number;
  companyResultCents: number;
  commissions: CommissionAmounts;
  reconciliationCents: number;
}
