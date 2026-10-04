export const telegramUsage = "Commands: /sale S01|Customer|A|Description|1000.00|50|30|20 or /expense E01|Description|MATERIALS|120.00|A";

type SaleCommand = {
  kind: "SALE";
  input: { reference: string; customer: string; project: string; description: string; amount: string; richard: string; anastasia: string; jeanClaude: string };
};
type ExpenseCommand = {
  kind: "EXPENSE";
  input: { reference: string; description: string; category: string; amount: string; proposedAllocation: string };
};
type InvalidCommand = { kind: "INVALID"; error: string };

export type TelegramCommand = SaleCommand | ExpenseCommand | InvalidCommand;

/**
 * Parses only the transport format. Role, amount, reference, and split checks
 * remain in the shared server-side validation/transaction service.
 */
export function parseTelegramCommand(text: string): TelegramCommand {
  const match = text.trim().match(/^\/(sale|expense)(?:@[a-z0-9_]+)?\s+([\s\S]+)$/iu);
  if (!match) return { kind: "INVALID", error: telegramUsage };

  const values = match[2].split("|").map((value) => value.trim());
  if (match[1].toLowerCase() === "sale") {
    if (values.length !== 8) return { kind: "INVALID", error: `/sale requires eight pipe-separated values. ${telegramUsage}` };
    const [reference, customer, project, description, amount, richard, anastasia, jeanClaude] = values;
    return { kind: "SALE", input: { reference, customer, project, description, amount, richard, anastasia, jeanClaude } };
  }

  if (values.length !== 5) return { kind: "INVALID", error: `/expense requires five pipe-separated values. ${telegramUsage}` };
  const [reference, description, category, amount, proposedAllocation] = values;
  return { kind: "EXPENSE", input: { reference, description, category, amount, proposedAllocation } };
}
