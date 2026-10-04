import type { AppState, CommissionAmounts, CommissionPerson, CommissionSplit, FinancialTotals, Project, Sale } from "@/lib/domain";

const tieBreak: CommissionPerson[] = ["richard", "anastasia", "jeanClaude"];

export function validateCommissionSplit(split: CommissionSplit): void {
  const values = tieBreak.map((person) => split[person]);
  if (values.some((value) => !Number.isInteger(value) || value < 0 || value > 10_000)) {
    throw new Error("Each commission share must be between 0% and 100%.");
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total !== 10_000) throw new Error("Commission shares must total exactly 100%.");
}

export function roundTenPercentCents(amountCents: number): number {
  // Positive amount only; half cents round up.
  return Math.floor((amountCents + 5) / 10);
}

export function calculateCommission(amountCents: number, split: CommissionSplit): { poolCents: number; amounts: CommissionAmounts } {
  validateCommissionSplit(split);
  const poolCents = roundTenPercentCents(amountCents);
  const amounts = Object.fromEntries(tieBreak.map((person) => [person, Math.floor((poolCents * split[person]) / 10_000)])) as CommissionAmounts;
  const difference = poolCents - Object.values(amounts).reduce((sum, value) => sum + value, 0);
  const largestShare = tieBreak.reduce((winner, person) => split[person] > split[winner] ? person : winner, tieBreak[0]);
  amounts[largestShare] += difference;
  return { poolCents, amounts };
}

export function calculateFinancialTotals(state: AppState): FinancialTotals {
  const blank = () => ({ approvedIncomeCents: 0, commissionExpenseCents: 0, allocatedExpenseCents: 0, resultCents: 0 });
  const projects: Record<Project, ReturnType<typeof blank>> = { A: blank(), B: blank() };
  const commissions: CommissionAmounts = { richard: 0, anastasia: 0, jeanClaude: 0 };
  let approvedIncomeCents = 0;
  let commissionExpenseCents = 0;
  let companyOverheadCents = 0;
  let awaitingAllocationCents = 0;

  for (const sale of state.sales.filter((sale) => sale.status === "APPROVED")) {
    projects[sale.project].approvedIncomeCents += sale.amountCents;
    projects[sale.project].commissionExpenseCents += sale.commissionPoolCents;
    approvedIncomeCents += sale.amountCents;
    commissionExpenseCents += sale.commissionPoolCents;
    for (const person of tieBreak) commissions[person] += sale.commissionAmounts[person];
  }
  for (const expense of state.expenses) {
    if (expense.status === "AWAITING_ALLOCATION") awaitingAllocationCents += expense.amountCents;
    else if (expense.finalAllocation === "OVERHEAD") companyOverheadCents += expense.amountCents;
    else if (expense.finalAllocation) projects[expense.finalAllocation].allocatedExpenseCents += expense.amountCents;
  }
  for (const project of ["A", "B"] as const) {
    projects[project].resultCents = projects[project].approvedIncomeCents - projects[project].commissionExpenseCents - projects[project].allocatedExpenseCents;
  }
  const companyResultCents = approvedIncomeCents - commissionExpenseCents - companyOverheadCents - awaitingAllocationCents - projects.A.allocatedExpenseCents - projects.B.allocatedExpenseCents;
  return {
    projects,
    approvedIncomeCents,
    commissionExpenseCents,
    companyOverheadCents,
    awaitingAllocationCents,
    companyResultCents,
    commissions,
    reconciliationCents: projects.A.resultCents + projects.B.resultCents - companyOverheadCents - awaitingAllocationCents,
  };
}

export function saleSplitChanged(sale: Sale): boolean {
  return Boolean(sale.finalSplit && tieBreak.some((person) => sale.proposedSplit[person] !== sale.finalSplit?.[person]));
}
