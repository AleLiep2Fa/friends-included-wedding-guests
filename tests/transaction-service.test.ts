import { describe, expect, it } from "vitest";
import { MemoryRepository } from "@/lib/memory-repository";
import { calculateFinancialTotals, calculateCommission, validateCommissionSplit } from "@/lib/rules";
import type { DeliveryResult, SideEffects } from "@/lib/transaction-service";
import { TransactionService } from "@/lib/transaction-service";
import type { ExpenseInput, SaleInput } from "@/lib/repository";

const split = (richard: number, anastasia: number, jeanClaude: number) => ({ richard: richard * 100, anastasia: anastasia * 100, jeanClaude: jeanClaude * 100 });
const sale = (reference: string, customer: string, project: "A" | "B", amountCents: number, proposedSplit = split(50, 30, 20), description = `${customer} service`): SaleInput => ({ reference, customer, project, description, amountCents, proposedSplit });
const expense = (reference: string, description: string, category: ExpenseInput["category"], amountCents: number, proposedAllocation: "A" | "B" | "OVERHEAD"): ExpenseInput => ({ reference, description, category, amountCents, proposedAllocation });

function make(options: { syncFails?: boolean; notificationFails?: boolean } = {}) {
  const repo = new MemoryRepository(); let syncFails = options.syncFails ?? false; let notificationFails = options.notificationFails ?? false;
  const ok = (state: DeliveryResult["state"]): DeliveryResult => ({ state });
  const effects: SideEffects = {
    sync: async () => { if (syncFails) throw new Error("Simulated Sheets outage"); return ok("SYNCED"); },
    submissionConfirmation: async () => { if (notificationFails) throw new Error("Simulated Telegram outage"); return ok("SENT"); },
    decisionNotification: async () => { if (notificationFails) throw new Error("Simulated Telegram outage"); return ok("SENT"); },
  };
  return { repo, service: new TransactionService(repo, effects), recoverSync: () => { syncFails = false; }, recoverNotification: () => { notificationFails = false; } };
}

async function runTestOne(system: ReturnType<typeof make>) {
  await system.service.submitSale("richard", "TELEGRAM", "1001", sale("S01", "Olivia Rose", "A", 100_000, split(50, 30, 20), "One proud uncle and an emotional grandmother"));
  await system.service.submitSale("anastasia", "WEBSITE", null, sale("S02", "Daniel King", "B", 200_000, split(0, 50, 50), "University friends, dancing, and the stripping performance"));
  await system.service.submitExpense("kevin", "TELEGRAM", "1001", expense("E01", "Rented suit and fake pearl necklace for the relatives", "MATERIALS", 12_000, "A"));
  await system.service.submitExpense("kevin", "WEBSITE", null, expense("E02", "Taxi for the grandmother; Kevin selected the wrong project", "TRAVEL", 8_000, "B"));
  await system.service.submitExpense("kevin", "WEBSITE", null, expense("E03", "Monthly company website subscription", "OTHER", 10_000, "OVERHEAD"));
  const beforeManagerActions = calculateFinancialTotals(await system.repo.getState());
  await system.service.approveSale("svetlana", "S01", split(50, 30, 20));
  await system.service.approveSale("svetlana", "S02", split(20, 40, 40));
  await system.service.approveExpense("svetlana", "E01", "A");
  await system.service.approveExpense("svetlana", "E02", "A");
  return beforeManagerActions;
}

describe("Friends Included transaction engine", () => {
  it("rounds the 10% pool and gives a rounding difference to the largest share using the required tie break", () => {
    expect(calculateCommission(105, split(50, 50, 0))).toEqual({ poolCents: 11, amounts: { richard: 6, anastasia: 5, jeanClaude: 0 } });
    expect(() => validateCommissionSplit(split(60, 30, 20))).toThrow("total exactly 100%");
  });

  it("accepts the defined temporary sync-control reference without weakening normal transaction validation", async () => {
    const system = make();
    await system.service.submitSale("richard", "WEBSITE", null, sale("SYNC-CHECK-001", "Sync control", "A", 100, split(100, 0, 0), "Temporary Sheets synchronization check"));
    expect((await system.repo.getRecord("SYNC-CHECK-001"))?.reference).toBe("SYNC-CHECK-001");
  });

  it("keeps pending sales out of income and commissions while every recorded expense affects company result", async () => {
    const system = make();
    await system.service.submitSale("richard", "WEBSITE", null, sale("S01", "Olivia Rose", "A", 100_000));
    await system.service.submitExpense("kevin", "WEBSITE", null, expense("E01", "Rented suit and fake pearl necklace for the relatives", "MATERIALS", 12_000, "A"));
    await system.service.submitExpense("kevin", "WEBSITE", null, expense("E02", "Monthly company website subscription", "OTHER", 10_000, "OVERHEAD"));
    const totals = calculateFinancialTotals(await system.repo.getState());
    expect(totals.approvedIncomeCents).toBe(0); expect(totals.commissionExpenseCents).toBe(0); expect(totals.awaitingAllocationCents).toBe(12_000); expect(totals.companyOverheadCents).toBe(10_000); expect(totals.companyResultCents).toBe(-22_000);
  });

  it("reproduces the exact Test 1 results through submissions and manager decisions", async () => {
    const system = make(); const beforeManagerActions = await runTestOne(system); const totals = calculateFinancialTotals(await system.repo.getState());
    expect(beforeManagerActions).toMatchObject({ approvedIncomeCents: 0, commissionExpenseCents: 0, companyResultCents: -30_000, awaitingAllocationCents: 20_000, companyOverheadCents: 10_000 });
    expect(totals.projects.A.resultCents).toBe(70_000); expect(totals.projects.B.resultCents).toBe(180_000); expect(totals.companyResultCents).toBe(240_000); expect(totals.commissionExpenseCents).toBe(30_000);
    expect(totals.commissions).toEqual({ richard: 9_000, anastasia: 11_000, jeanClaude: 10_000 });
  });

  it("retains Test 1 and reproduces cumulative Test 2 results without hard-coded totals", async () => {
    const system = make(); await runTestOne(system);
    await system.service.submitSale("jean-claude", "WEBSITE", null, sale("S03", "Emma Stonebridge", "A", 150_000, split(40, 40, 20), "Premium relatives, including an uncle presented as a surgeon"));
    await system.service.submitSale("richard", "WEBSITE", null, sale("S04", "Lucas Green", "B", 80_000, split(25, 25, 50), "Small group of loud university friends"));
    await system.service.submitSale("richard", "WEBSITE", null, sale("S05", "Mia Brooks", "B", 60_000, split(100, 0, 0), "Extra guests and an embarrassing speech"));
    await system.service.submitExpense("kevin", "WEBSITE", null, expense("E04", "Replacement costumes after an enthusiastic dance performance", "MATERIALS", 25_000, "B"));
    await system.service.submitExpense("kevin", "WEBSITE", null, expense("E05", "Minibus for university friends; Kevin selected the wrong project again", "TRAVEL", 9_000, "A"));
    await system.service.submitExpense("kevin", "WEBSITE", null, expense("E06", "Company telephone subscription", "OTHER", 6_000, "OVERHEAD"));
    await system.service.submitExpense("kevin", "WEBSITE", null, expense("E07", "Emergency replacement clothing; project allocation still needs checking", "MATERIALS", 14_000, "A"));
    await system.service.approveSale("svetlana", "S03", split(20, 30, 50)); await system.service.approveSale("svetlana", "S04", split(25, 25, 50));
    await system.service.approveExpense("svetlana", "E04", "B"); await system.service.approveExpense("svetlana", "E05", "B");
    const state = await system.repo.getState(); const totals = calculateFinancialTotals(state);
    expect(totals.projects.A).toMatchObject({ approvedIncomeCents: 250_000, commissionExpenseCents: 25_000, allocatedExpenseCents: 20_000, resultCents: 205_000 });
    expect(totals.projects.B).toMatchObject({ approvedIncomeCents: 280_000, commissionExpenseCents: 28_000, allocatedExpenseCents: 34_000, resultCents: 218_000 });
    expect(totals).toMatchObject({ approvedIncomeCents: 530_000, commissionExpenseCents: 53_000, companyOverheadCents: 16_000, awaitingAllocationCents: 14_000, companyResultCents: 393_000, reconciliationCents: 393_000, commissions: { richard: 14_000, anastasia: 17_500, jeanClaude: 21_500 } });
    expect(state.sales.find((record) => record.reference === "S05")?.status).toBe("PENDING_APPROVAL"); expect(state.expenses.find((record) => record.reference === "E07")?.status).toBe("AWAITING_ALLOCATION");
  });

  it("enforces roles, valid amounts and duplicate references in the server-side service", async () => {
    const system = make();
    await expect(system.service.submitSale("kevin", "WEBSITE", null, sale("S01", "Olivia Rose", "A", 100_000))).rejects.toThrow("not permitted");
    await system.service.submitSale("richard", "WEBSITE", null, sale("S01", "Olivia Rose", "A", 100_000));
    await expect(system.service.approveSale("richard", "S01", split(50, 30, 20))).rejects.toThrow("not permitted");
    await expect(system.service.submitSale("anastasia", "WEBSITE", null, sale("S01", "Duplicate", "B", 1_000))).rejects.toThrow("already exists");
    await expect(system.service.submitExpense("kevin", "WEBSITE", null, expense("E01", "Zero amount", "MATERIALS", 0, "A"))).rejects.toThrow();
    expect(calculateFinancialTotals(await system.repo.getState()).approvedIncomeCents).toBe(0);
  });

  it("makes a second approval idempotent without changing records or totals", async () => {
    const system = make(); await system.service.submitSale("richard", "WEBSITE", null, sale("S01", "Olivia Rose", "A", 100_000));
    expect((await system.service.approveSale("svetlana", "S01", split(50, 30, 20))).changed).toBe(true);
    const before = calculateFinancialTotals(await system.repo.getState()); expect((await system.service.approveSale("svetlana", "S01", split(50, 30, 20))).changed).toBe(false);
    expect(calculateFinancialTotals(await system.repo.getState())).toEqual(before);
  });

  it("records a Sheets failure and retries the same reference without changing financial totals", async () => {
    const system = make({ syncFails: true }); await system.service.submitSale("richard", "WEBSITE", null, sale("S01", "Olivia Rose", "A", 100_000)); await system.service.approveSale("svetlana", "S01", split(50, 30, 20));
    const before = calculateFinancialTotals(await system.repo.getState()); expect((await system.repo.getRecord("S01"))?.syncState).toBe("FAILED"); system.recoverSync(); await system.service.retrySync("svetlana", "S01");
    expect((await system.repo.getRecord("S01"))?.syncState).toBe("SYNCED"); expect(calculateFinancialTotals(await system.repo.getState())).toEqual(before); expect((await system.repo.getState()).sales).toHaveLength(1);
  });

  it("records Telegram delivery failure separately from approval and preserves state across a service reload", async () => {
    const system = make({ notificationFails: true }); await system.service.submitSale("richard", "TELEGRAM", "1001", sale("S01", "Olivia Rose", "A", 100_000)); await system.service.approveSale("svetlana", "S01", split(50, 30, 20));
    expect((await system.repo.getRecord("S01"))?.notificationState).toBe("FAILED"); expect(calculateFinancialTotals(await system.repo.getState()).companyResultCents).toBe(90_000);
    const reloaded = new TransactionService(system.repo, { sync: async () => ({ state: "SYNCED" }), submissionConfirmation: async () => ({ state: "SENT" }), decisionNotification: async () => ({ state: "SENT" }) });
    expect((await system.repo.getRecord("S01"))?.status).toBe("APPROVED"); system.recoverNotification(); await reloaded.retryNotification("svetlana", "S01"); expect((await system.repo.getRecord("S01"))?.notificationState).toBe("SENT");
  });
});
