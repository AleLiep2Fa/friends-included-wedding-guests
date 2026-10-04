"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { AppState, CommissionSplit, Employee, Expense, FinancialTotals, Sale } from "@/lib/domain";
import { employees } from "@/lib/domain";
import { formatEuro, formatPercentage } from "@/lib/money";

type StateResponse = { actor: Employee; state: AppState; totals: FinancialTotals | null };
const label = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

async function request(path: string, body?: Record<string, unknown>) {
  const response = await fetch(path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : undefined);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "The action could not be completed.");
  return data;
}

function Status({ value }: { value: string }) { return <span className={`status status-${value.toLowerCase()}`}>{label(value)}</span>; }
function Money({ cents }: { cents: number }) { return <span className={cents < 0 ? "negative" : ""}>{formatEuro(cents)}</span>; }

export function AppClient() {
  const [actorId, setActorId] = useState("richard");
  const [data, setData] = useState<StateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try { setError(null); const response = await request(`/api/state?actorId=${encodeURIComponent(actorId)}`); setData(response as StateResponse); }
    catch (cause) { setData(null); setError(cause instanceof Error ? cause.message : "Unable to load records."); }
  }, [actorId]);
  useEffect(() => { void refresh(); }, [refresh]);
  const complete = async (path: string, body: Record<string, unknown>, message: string) => { try { setError(null); await request(path, { ...body, actorId }); setNotice(message); await refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : "The action failed."); } };
  const actor = data?.actor ?? employees.find((employee) => employee.id === actorId)!;
  return <main className="shell">
    <header className="hero">
      <p className="eyebrow">Friends Included Ltd</p><h1>Wedding Guests for Hire</h1>
      <p>Record fictional sales and expenses, approve decisions, and keep the project and company results honest.</p>
      <p className="owner">Built by Aleksandrs Liepnieks</p>
      <nav aria-label="External links" className="links">
        <ExternalLink href={process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL} label="Telegram bot" />
        <ExternalLink href={process.env.NEXT_PUBLIC_GOOGLE_SHEETS_URL} label="Google Sheets" />
        <ExternalLink href={process.env.NEXT_PUBLIC_GITHUB_REPOSITORY_URL} label="GitHub repository" />
      </nav>
    </header>
    <section className="role-card" aria-labelledby="role-heading">
      <div><p className="eyebrow">Classroom access</p><h2 id="role-heading">Demonstration role</h2><p>Choose the fictional person whose permissions you want to test. The server validates every action against this selection.</p></div>
      <label><span className="sr-only">Demonstration role</span><select value={actorId} onChange={(event) => { setActorId(event.target.value); setNotice(null); }}>
        {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} — {label(employee.role)}</option>)}
      </select></label>
    </section>
    {error && <p className="message error" role="alert">{error}</p>}
    {notice && <p className="message success" role="status">{notice}</p>}
    {!data && !error && <p className="message">Loading the persisted ledger…</p>}
    {data && <>
      <section className="instruction"><strong>How to use it:</strong> salespeople enter sales and their proposed split; Kevin enters paid expenses; Svetlana reviews pending items and can approve or correct them. A sale affects results only after approval. Expenses affect company result as soon as they are recorded.</section>
      {actor.role === "SALESPERSON" && <SaleForm actorId={actorId} submit={(body) => complete("/api/sales", body, "Sale saved. It is pending Svetlana’s approval.")} />}
      {actor.role === "EXPENSE_REPORTER" && <ExpenseForm actorId={actorId} submit={(body) => complete("/api/expenses", body, "Expense saved. Company overhead is allocated automatically; project expenses await Svetlana’s decision.")} />}
      {actor.role === "MANAGER" && <Manager state={data.state} actorId={actorId} submit={(body, message) => complete("/api/manager", body, message)} />}
      {data.totals ? <Dashboard totals={data.totals} /> : <section className="panel"><h2>Your submissions</h2><p>Only Svetlana’s manager view shows company and project financial totals.</p></section>}
      <Records state={data.state} manager={actor.role === "MANAGER"} retry={(reference, action) => complete("/api/manager", { action, reference }, `${label(action)} completed for ${reference}.`)} />
    </>}
  </main>;
}

function ExternalLink({ href, label: text }: { href?: string; label: string }) { return href ? <a href={href} target="_blank" rel="noreferrer">{text}</a> : <span aria-label={`${text} not configured`}>{text}: not configured</span>; }

function SaleForm({ actorId, submit }: { actorId: string; submit: (body: Record<string, unknown>) => Promise<void> }) {
  const onSubmit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = event.currentTarget; await submit({ ...Object.fromEntries(new FormData(form)), actorId }); form.reset(); };
  return <section className="panel" aria-labelledby="sale-entry"><h2 id="sale-entry">Record a sale</h2><p className="muted">The commission pool is 10% of the sale. Shares must total exactly 100%.</p><form onSubmit={onSubmit} className="form-grid">
    <Field name="reference" label="Unique reference" placeholder="S01" required /><Field name="customer" label="Customer" required /><label>Project<select name="project" defaultValue="A"><option value="A">Project A — Respectable Relatives</option><option value="B">Project B — Drunk University Friends</option></select></label><Field name="amount" label="Amount EUR" inputMode="decimal" placeholder="1000.00" required /><label className="wide">Description<textarea name="description" required /></label>
    <fieldset className="wide split"><legend>Proposed commission split</legend><Field name="richard" label="Richard %" defaultValue="0" required /><Field name="anastasia" label="Anastasia %" defaultValue="0" required /><Field name="jeanClaude" label="Jean-Claude %" defaultValue="0" required /></fieldset><button type="submit">Save pending sale</button>
  </form></section>;
}
function ExpenseForm({ actorId, submit }: { actorId: string; submit: (body: Record<string, unknown>) => Promise<void> }) {
  const onSubmit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = event.currentTarget; await submit({ ...Object.fromEntries(new FormData(form)), actorId }); form.reset(); };
  return <section className="panel" aria-labelledby="expense-entry"><h2 id="expense-entry">Record a paid expense</h2><p className="muted">Project allocations await Svetlana. Company overhead is automatically allocated.</p><form onSubmit={onSubmit} className="form-grid">
    <Field name="reference" label="Unique reference" placeholder="E01" required /><Field name="amount" label="Amount EUR" inputMode="decimal" placeholder="120.00" required /><label>Category<select name="category" defaultValue="MATERIALS"><option value="MATERIALS">Materials</option><option value="TRAVEL">Travel</option><option value="OTHER">Other</option></select></label><label>Proposed allocation<select name="proposedAllocation" defaultValue="A"><option value="A">Project A</option><option value="B">Project B</option><option value="OVERHEAD">Company overhead</option></select></label><label className="wide">Description<textarea name="description" required /></label><button type="submit">Save expense</button>
  </form></section>;
}
function Field({ label: text, name, defaultValue, ...props }: { label: string; name: string; defaultValue?: string } & React.InputHTMLAttributes<HTMLInputElement>) { return <label>{text}<input name={name} defaultValue={defaultValue} {...props} /></label>; }

function Manager({ state, actorId, submit }: { state: AppState; actorId: string; submit: (body: Record<string, unknown>, message: string) => Promise<void> }) {
  const pendingSales = state.sales.filter((sale) => sale.status === "PENDING_APPROVAL"); const pendingExpenses = state.expenses.filter((expense) => expense.status === "AWAITING_ALLOCATION");
  return <section className="manager"><section className="panel"><h2>Manager decisions</h2><p>Approve the proposal or correct it before approval. Leaving an item here keeps it out of the relevant project result.</p>{!pendingSales.length && !pendingExpenses.length && <p>No decisions are awaiting approval.</p>}
    {pendingSales.map((sale) => <SaleApproval key={sale.reference} sale={sale} actorId={actorId} submit={submit} />)}
    {pendingExpenses.map((expense) => <ExpenseApproval key={expense.reference} expense={expense} actorId={actorId} submit={submit} />)}
  </section><TelegramLink actorId={actorId} submit={submit} /></section>;
}
function SaleApproval({ sale, actorId, submit }: { sale: Sale; actorId: string; submit: (body: Record<string, unknown>, message: string) => Promise<void> }) {
  const onSubmit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); await submit({ ...Object.fromEntries(new FormData(event.currentTarget)), actorId, action: "APPROVE_SALE", reference: sale.reference }, `${sale.reference} approved; its decision notification is tracked separately.`); };
  return <form className="decision" onSubmit={onSubmit}><h3>{sale.reference} — {sale.customer} <Money cents={sale.amountCents} /></h3><p>Project {sale.project}; proposed: {splitText(sale.proposedSplit)}.</p><div className="mini-grid"><Field name="richard" label="Richard %" defaultValue={String(sale.proposedSplit.richard / 100)} required /><Field name="anastasia" label="Anastasia %" defaultValue={String(sale.proposedSplit.anastasia / 100)} required /><Field name="jeanClaude" label="Jean-Claude %" defaultValue={String(sale.proposedSplit.jeanClaude / 100)} required /></div><button type="submit">Approve sale</button></form>;
}
function ExpenseApproval({ expense, actorId, submit }: { expense: Expense; actorId: string; submit: (body: Record<string, unknown>, message: string) => Promise<void> }) {
  const onSubmit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); await submit({ ...Object.fromEntries(new FormData(event.currentTarget)), actorId, action: "APPROVE_EXPENSE", reference: expense.reference }, `${expense.reference} allocation approved; its decision notification is tracked separately.`); };
  return <form className="decision" onSubmit={onSubmit}><h3>{expense.reference} — <Money cents={expense.amountCents} /></h3><p>{expense.description}. Proposed: {expense.proposedAllocation}.</p><label>Final allocation<select name="allocation" defaultValue={expense.proposedAllocation}><option value="A">Project A</option><option value="B">Project B</option><option value="OVERHEAD">Company overhead</option></select></label><button type="submit">Confirm allocation</button></form>;
}
function TelegramLink({ actorId, submit }: { actorId: string; submit: (body: Record<string, unknown>, message: string) => Promise<void> }) {
  const onSubmit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = event.currentTarget; await submit({ ...Object.fromEntries(new FormData(form)), actorId, action: "LINK_TELEGRAM" }, "Telegram employee link saved."); form.reset(); };
  return <section className="panel"><h2>Manager Telegram setup</h2><p>Only Svetlana can link a Telegram user to a fictional employee. The bot never accepts self-assigned roles.</p><form onSubmit={onSubmit} className="form-grid"><Field name="telegramUserId" label="Telegram user ID" inputMode="numeric" required /><Field name="chatId" label="Telegram chat ID" inputMode="numeric" required /><label>Employee<select name="employeeId">{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label><button type="submit">Save Telegram link</button></form></section>;
}
function Dashboard({ totals }: { totals: FinancialTotals }) { return <section className="dashboard"><h2>Financial dashboard</h2><div className="cards"><ProjectCard title="Project A — Respectable Relatives" totals={totals.projects.A} /><ProjectCard title="Project B — Drunk University Friends" totals={totals.projects.B} /><article className="card"><h3>Company</h3><Metric name="Approved income" cents={totals.approvedIncomeCents} /><Metric name="Sales commissions" cents={-totals.commissionExpenseCents} /><Metric name="Company overhead" cents={-totals.companyOverheadCents} /><Metric name="Awaiting allocation" cents={-totals.awaitingAllocationCents} /><Metric name="Company result" cents={totals.companyResultCents} strong /></article></div><section className="panel commission"><h3>Commission earned</h3><Metric name="Richard" cents={totals.commissions.richard} /><Metric name="Anastasia" cents={totals.commissions.anastasia} /><Metric name="Jean-Claude" cents={totals.commissions.jeanClaude} /><Metric name="Reconciliation" cents={totals.reconciliationCents} strong /></section></section>; }
function ProjectCard({ title, totals }: { title: string; totals: FinancialTotals["projects"]["A"] }) { return <article className="card"><h3>{title}</h3><Metric name="Approved income" cents={totals.approvedIncomeCents} /><Metric name="Commission expense" cents={-totals.commissionExpenseCents} /><Metric name="Allocated expense" cents={-totals.allocatedExpenseCents} /><Metric name="Result" cents={totals.resultCents} strong /></article>; }
function Metric({ name, cents, strong = false }: { name: string; cents: number; strong?: boolean }) { return <p className={strong ? "metric strong" : "metric"}><span>{name}</span><Money cents={cents} /></p>; }
function Records({ state, manager, retry }: { state: AppState; manager: boolean; retry: (reference: string, action: "RETRY_SYNC" | "RETRY_NOTIFICATION") => Promise<void> }) { const records = [...state.sales, ...state.expenses].sort((a, b) => a.reference.localeCompare(b.reference)); return <section className="panel records"><h2>Transaction records</h2>{!records.length ? <p>No persisted records are visible for this role.</p> : <div className="record-list">{records.map((record) => <article className="record" key={record.reference}><div><h3>{record.reference} <Status value={record.type === "SALE" ? record.status : record.status} /></h3><p><strong>{record.type === "SALE" ? employeeName(record.submitterId) : employeeName(record.submitterId)}</strong> via {label(record.source)} at {new Date(record.createdAt).toLocaleString("en-IE")}</p><p>{record.type === "SALE" ? <>Sale: {record.customer}, Project {record.project}, <Money cents={record.amountCents} />. Original split {splitText(record.proposedSplit)}; final {record.finalSplit ? splitText(record.finalSplit) : "not approved"}.</> : <>Expense: {record.description}, {label(record.category)}, <Money cents={record.amountCents} />. Proposed {record.proposedAllocation}; final {record.finalAllocation ?? "awaiting allocation"}.</>}</p><p><Status value={record.syncState} /> <Status value={record.notificationState} /> {record.originatingChatId ? "Original Telegram chat retained." : "Website entry."}</p></div>{manager && <div className="record-actions">{record.syncState !== "SYNCED" && <button onClick={() => void retry(record.reference, "RETRY_SYNC")}>Retry Sheets sync</button>}{["FAILED", "NO_RECIPIENT", "NOT_CONFIGURED"].includes(record.notificationState) && <button onClick={() => void retry(record.reference, "RETRY_NOTIFICATION")}>Retry notification</button>}</div>}</article>)}</div>}</section>; }
function employeeName(id: string) { return employees.find((employee) => employee.id === id)?.name ?? id; }
function splitText(split: CommissionSplit) { return `Richard ${formatPercentage(split.richard)}, Anastasia ${formatPercentage(split.anastasia)}, Jean-Claude ${formatPercentage(split.jeanClaude)}`; }
