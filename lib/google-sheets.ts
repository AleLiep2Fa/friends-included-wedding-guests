import "server-only";
import { google } from "googleapis";
import type { Expense, Sale } from "@/lib/domain";
import { employees, commissionPeople } from "@/lib/domain";
import { formatEuro, formatPercentage } from "@/lib/money";
import { googleSheetsConfiguration, googleSheetsUpsertPlan, type GoogleServiceAccountCredentials } from "@/lib/google-sheets-config";

const salesHeaders = ["Reference", "Submission time", "Salesperson", "Customer", "Project", "Description", "Amount", "Original Richard %", "Original Anastasia %", "Original Jean-Claude %", "Approved Richard %", "Approved Anastasia %", "Approved Jean-Claude %", "Richard earned commission", "Anastasia earned commission", "Jean-Claude earned commission", "Status"];
const expenseHeaders = ["Reference", "Submission time", "Reporter", "Description", "Category", "Amount", "Proposed allocation", "Final allocation", "Status"];

function client(credentials: GoogleServiceAccountCredentials) {
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  return google.sheets({ version: "v4", auth });
}
function employeeName(id: string) { return employees.find((employee) => employee.id === id)?.name ?? id; }

async function assertRequiredTabs(sheets: ReturnType<typeof client>, spreadsheetId: string) {
  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties.title" });
  const titles = (metadata.data.sheets ?? []).map((sheet) => sheet.properties?.title).filter(Boolean).sort();
  if (titles.length !== 2 || titles[0] !== "Expenses" || titles[1] !== "Sales") throw new Error("The configured Google Sheet must contain exactly two tabs named Sales and Expenses.");
}
async function updateByReference(sheets: ReturnType<typeof client>, spreadsheetId: string, tab: "Sales" | "Expenses", headers: string[], values: string[]) {
  const existing = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${tab}!A:Q` });
  const rows = (existing.data.values ?? []) as string[][];
  const plan = googleSheetsUpsertPlan(rows, headers, values[0]);
  if (plan.writeHeaders) await sheets.spreadsheets.values.update({ spreadsheetId, range: `${tab}!A1`, valueInputOption: "RAW", requestBody: { values: [headers] } });
  await sheets.spreadsheets.values.update({ spreadsheetId, range: `${tab}!A${plan.rowNumber}`, valueInputOption: "RAW", requestBody: { values: [values] } });
}

export async function syncToGoogleSheets(record: Sale | Expense): Promise<{ configured: boolean; error?: string }> {
  const configuration = googleSheetsConfiguration();
  if (!configuration.configured) return configuration;
  const sheets = client(configuration.credentials);
  await assertRequiredTabs(sheets, configuration.spreadsheetId);
  if (record.type === "SALE") {
    const proposed = record.proposedSplit; const final = record.finalSplit;
    await updateByReference(sheets, configuration.spreadsheetId, "Sales", salesHeaders, [record.reference, record.createdAt, employeeName(record.submitterId), record.customer, record.project, record.description, formatEuro(record.amountCents),
      formatPercentage(proposed.richard), formatPercentage(proposed.anastasia), formatPercentage(proposed.jeanClaude),
      final ? formatPercentage(final.richard) : "", final ? formatPercentage(final.anastasia) : "", final ? formatPercentage(final.jeanClaude) : "",
      ...commissionPeople.map((person) => formatEuro(record.commissionAmounts[person])), record.status]);
  } else {
    await updateByReference(sheets, configuration.spreadsheetId, "Expenses", expenseHeaders, [record.reference, record.createdAt, employeeName(record.submitterId), record.description, record.category, formatEuro(record.amountCents), record.proposedAllocation, record.finalAllocation ?? "", record.status]);
  }
  return { configured: true };
}
