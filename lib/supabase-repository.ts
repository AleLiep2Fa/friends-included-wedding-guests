import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { employees, type AppState, type CommissionSplit, type Employee, type EmployeeId, type Expense, type ExpenseAllocation, type NotificationAttempt, type NotificationState, type Sale, type SyncAttempt, type SyncState, type TransactionSource } from "@/lib/domain";
import type { ExpenseInput, SaleInput, TransactionRepository } from "@/lib/repository";

type Row = Record<string, unknown>;

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}. Configure Supabase before using persisted records.`);
  return value;
}
function iso(value: unknown) { return typeof value === "string" ? value : new Date().toISOString(); }
function asString(value: unknown) { return value == null ? null : String(value); }
function split(row: Row, prefix: "proposed" | "final"): CommissionSplit | null {
  const r = row[`${prefix}_richard_bps`]; const a = row[`${prefix}_anastasia_bps`]; const j = row[`${prefix}_jean_claude_bps`];
  if (r == null || a == null || j == null) return null;
  return { richard: Number(r), anastasia: Number(a), jeanClaude: Number(j) };
}

/** Server-only adapter; all application mutation goes through Postgres RPCs in the migrations. */
export class SupabaseRepository implements TransactionRepository {
  private client: SupabaseClient;
  constructor() { this.client = createClient(requiredEnvironment("SUPABASE_URL"), requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } }); }
  private async fail<T>(result: { data: T | null; error: { message: string } | null }): Promise<T> { if (result.error) throw new Error(result.error.message); if (result.data == null) throw new Error("Expected database result was not returned."); return result.data; }
  async getEmployee(id: string): Promise<Employee | null> { return employees.find((employee) => employee.id === id) ?? null; }
  async getEmployeeByTelegramUserId(telegramUserId: string) {
    const link = await this.client.from("telegram_employee_links").select("employee_id, chat_id").eq("telegram_user_id", telegramUserId).maybeSingle();
    if (link.error) throw new Error(link.error.message); if (!link.data) return null;
    const employee = await this.getEmployee(String(link.data.employee_id));
    return employee ? { employee, chatId: String(link.data.chat_id) } : null;
  }
  async getEmployeeChatId(employeeId: EmployeeId) {
    const result = await this.client.from("telegram_employee_links").select("chat_id").eq("employee_id", employeeId).maybeSingle();
    if (result.error) throw new Error(result.error.message); return result.data ? String(result.data.chat_id) : null;
  }
  async linkTelegramEmployee(managerId: EmployeeId, telegramUserId: string, chatId: string, employeeId: EmployeeId) {
    if (managerId !== "svetlana") throw new Error("Only Svetlana may link Telegram users.");
    const previous = await this.client.from("telegram_employee_links").delete().eq("employee_id", employeeId);
    if (previous.error) throw new Error(previous.error.message);
    const result = await this.client.from("telegram_employee_links").upsert({ telegram_user_id: telegramUserId, employee_id: employeeId, chat_id: chatId, linked_by: managerId }, { onConflict: "telegram_user_id" });
    if (result.error) throw new Error(result.error.message);
  }
  async submitSale(actorId: EmployeeId, source: TransactionSource, chatId: string | null, input: SaleInput) {
    const id = await this.fail(await this.client.rpc("submit_sale", { p_actor: actorId, p_source: source, p_chat_id: chatId, p_value: input }));
    const record = await this.getRecord(input.reference); if (!record || record.type !== "SALE") throw new Error(`Saved sale ${String(id)} could not be retrieved.`); return record;
  }
  async submitExpense(actorId: EmployeeId, source: TransactionSource, chatId: string | null, input: ExpenseInput) {
    const id = await this.fail(await this.client.rpc("submit_expense", { p_actor: actorId, p_source: source, p_chat_id: chatId, p_value: input }));
    const record = await this.getRecord(input.reference); if (!record || record.type !== "EXPENSE") throw new Error(`Saved expense ${String(id)} could not be retrieved.`); return record;
  }
  async approveSale(managerId: EmployeeId, reference: string, finalSplit: CommissionSplit) {
    const changed = Boolean(await this.fail(await this.client.rpc("approve_sale", { p_manager: managerId, p_reference: reference, p_split: finalSplit })));
    const record = await this.getRecord(reference); if (!record || record.type !== "SALE") throw new Error("Approved sale could not be retrieved."); return { sale: record, changed };
  }
  async approveExpense(managerId: EmployeeId, reference: string, finalAllocation: ExpenseAllocation) {
    const changed = Boolean(await this.fail(await this.client.rpc("approve_expense", { p_manager: managerId, p_reference: reference, p_allocation: finalAllocation })));
    const record = await this.getRecord(reference); if (!record || record.type !== "EXPENSE") throw new Error("Approved expense could not be retrieved."); return { expense: record, changed };
  }
  private mapSale(row: Row): Sale {
    const tx = row.transactions as Row;
    return { id: String(row.transaction_id), type: "SALE", reference: String(tx.reference), source: String(tx.source) as TransactionSource, submitterId: String(tx.submitter_id) as EmployeeId, originatingChatId: asString(tx.originating_telegram_chat_id), createdAt: iso(tx.created_at), syncState: String(tx.sync_state) as SyncState, notificationState: String(tx.notification_state) as NotificationState,
      customer: String(row.customer), project: String(row.project) as "A" | "B", description: String(row.description), amountCents: Number(row.amount_cents), status: String(row.status) as Sale["status"], proposedSplit: split(row, "proposed")!, finalSplit: split(row, "final"), commissionPoolCents: Number(row.commission_pool_cents), commissionAmounts: { richard: Number(row.richard_commission_cents), anastasia: Number(row.anastasia_commission_cents), jeanClaude: Number(row.jean_claude_commission_cents) }, approvedAt: asString(row.approved_at), approvedBy: asString(row.approved_by) as EmployeeId | null };
  }
  private mapExpense(row: Row): Expense {
    const tx = row.transactions as Row;
    return { id: String(row.transaction_id), type: "EXPENSE", reference: String(tx.reference), source: String(tx.source) as TransactionSource, submitterId: String(tx.submitter_id) as EmployeeId, originatingChatId: asString(tx.originating_telegram_chat_id), createdAt: iso(tx.created_at), syncState: String(tx.sync_state) as SyncState, notificationState: String(tx.notification_state) as NotificationState,
      description: String(row.description), category: String(row.category) as Expense["category"], amountCents: Number(row.amount_cents), proposedAllocation: String(row.proposed_allocation) as ExpenseAllocation, finalAllocation: asString(row.final_allocation) as ExpenseAllocation | null, status: String(row.status) as Expense["status"], approvedAt: asString(row.approved_at), approvedBy: asString(row.approved_by) as EmployeeId | null };
  }
  async getState(): Promise<AppState> {
    const [salesResult, expensesResult, linksResult, syncResult, notificationResult] = await Promise.all([
      this.client.from("sales").select("*, transactions!inner(*)").order("approved_at", { ascending: true, nullsFirst: true }),
      this.client.from("expenses").select("*, transactions!inner(*)").order("approved_at", { ascending: true, nullsFirst: true }),
      this.client.from("telegram_employee_links").select("employee_id, chat_id"),
      this.client.from("google_sheets_sync_attempts").select("status, error, attempted_at, transactions!inner(reference)").order("attempted_at", { ascending: false }),
      this.client.from("telegram_notification_attempts").select("status, error, attempted_at, transactions!inner(reference)").order("attempted_at", { ascending: false }),
    ]);
    for (const result of [salesResult, expensesResult, linksResult, syncResult, notificationResult]) if (result.error) throw new Error(result.error.message);
    const telegramLinks = Object.fromEntries(employees.map((employee) => [employee.id, null])) as AppState["telegramLinks"];
    for (const link of linksResult.data ?? []) telegramLinks[String(link.employee_id) as EmployeeId] = String(link.chat_id);
    return {
      employees: [...employees], sales: (salesResult.data ?? []).map((row) => this.mapSale(row as Row)), expenses: (expensesResult.data ?? []).map((row) => this.mapExpense(row as Row)), telegramLinks,
      syncAttempts: (syncResult.data ?? []).map((row) => { const x = row as unknown as Row; return { reference: String((x.transactions as Row).reference), status: String(x.status) as SyncAttempt["status"], error: asString(x.error), attemptedAt: iso(x.attempted_at) }; }),
      notificationAttempts: (notificationResult.data ?? []).map((row) => { const x = row as unknown as Row; return { reference: String((x.transactions as Row).reference), status: String(x.status) as NotificationAttempt["status"], error: asString(x.error), attemptedAt: iso(x.attempted_at) }; }),
    };
  }
  async getRecord(reference: string) { const state = await this.getState(); return state.sales.find((sale) => sale.reference === reference) ?? state.expenses.find((expense) => expense.reference === reference) ?? null; }
  private async transactionId(reference: string): Promise<string> { const result = await this.client.from("transactions").select("id").eq("reference", reference).single(); const row = await this.fail(result); return String(row.id); }
  async recordSync(reference: string, state: SyncState, attempt: SyncAttempt) {
    const transactionId = await this.transactionId(reference);
    const [status, insert] = await Promise.all([this.client.from("transactions").update({ sync_state: state }).eq("id", transactionId), this.client.from("google_sheets_sync_attempts").insert({ transaction_id: transactionId, status: attempt.status, error: attempt.error })]);
    if (status.error) throw new Error(status.error.message); if (insert.error) throw new Error(insert.error.message);
  }
  async recordNotification(reference: string, state: NotificationState, attempt: NotificationAttempt) {
    const transactionId = await this.transactionId(reference);
    const [status, insert] = await Promise.all([this.client.from("transactions").update({ notification_state: state }).eq("id", transactionId), this.client.from("telegram_notification_attempts").insert({ transaction_id: transactionId, status: attempt.status, error: attempt.error })]);
    if (status.error) throw new Error(status.error.message); if (insert.error) throw new Error(insert.error.message);
  }
}
