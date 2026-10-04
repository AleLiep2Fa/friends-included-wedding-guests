import { z } from "zod";
import { parseEuroToCents, parsePercentageToBasisPoints } from "@/lib/money";
import type { CommissionSplit } from "@/lib/domain";
import { validateCommissionSplit } from "@/lib/rules";
import type { ExpenseInput, SaleInput } from "@/lib/repository";

const reference = z.string().trim().toUpperCase().regex(/^(?:[A-Z][0-9]{2,}|SYNC-CHECK-[0-9]{3,})$/u, "Use a reference such as S01, E07, or SYNC-CHECK-001.");
const text = z.string().trim().min(1, "This field is required.").max(500);

function parseSplit(value: Record<string, unknown>): CommissionSplit {
  const split = { richard: parsePercentageToBasisPoints(value.richard), anastasia: parsePercentageToBasisPoints(value.anastasia), jeanClaude: parsePercentageToBasisPoints(value.jeanClaude) };
  validateCommissionSplit(split); return split;
}

export function validateSaleInput(raw: unknown): SaleInput {
  const input = z.object({ reference, customer: text, project: z.enum(["A", "B"]), description: text, amount: z.unknown(), richard: z.unknown(), anastasia: z.unknown(), jeanClaude: z.unknown() }).parse(raw);
  return { reference: input.reference, customer: input.customer, project: input.project, description: input.description, amountCents: parseEuroToCents(input.amount), proposedSplit: parseSplit(input) };
}

export function validateExpenseInput(raw: unknown): ExpenseInput {
  const input = z.object({ reference, description: text, category: z.enum(["MATERIALS", "TRAVEL", "OTHER"]), amount: z.unknown(), proposedAllocation: z.enum(["A", "B", "OVERHEAD"]) }).parse(raw);
  return { reference: input.reference, description: input.description, category: input.category, amountCents: parseEuroToCents(input.amount), proposedAllocation: input.proposedAllocation };
}

export function validateFinalSplit(raw: unknown): CommissionSplit {
  const input = z.object({ richard: z.unknown(), anastasia: z.unknown(), jeanClaude: z.unknown() }).parse(raw);
  return parseSplit(input);
}
