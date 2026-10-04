export type GoogleServiceAccountCredentials = { type: "service_account"; client_email: string; private_key: string; project_id?: string };
export type GoogleSheetsConfiguration =
  | { configured: true; spreadsheetId: string; credentials: GoogleServiceAccountCredentials }
  | { configured: false; error: string };

type Environment = Readonly<Record<string, string | undefined>>;

/** Validates only server-side configuration; it never calls Google. */
export function googleSheetsConfiguration(env: Environment = process.env): GoogleSheetsConfiguration {
  const spreadsheetId = env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  const rawCredentials = env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!spreadsheetId || !rawCredentials) return { configured: false, error: "Google Sheets is not configured. Set GOOGLE_SHEETS_SPREADSHEET_ID and GOOGLE_SERVICE_ACCOUNT_JSON server-side." };

  let parsed: unknown;
  try { parsed = JSON.parse(rawCredentials); } catch { return { configured: false, error: "GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON." }; }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { configured: false, error: "GOOGLE_SERVICE_ACCOUNT_JSON must be a service-account JSON object." };
  const credentials = parsed as Record<string, unknown>;
  if (credentials.type !== "service_account" || typeof credentials.client_email !== "string" || !credentials.client_email || typeof credentials.private_key !== "string" || !credentials.private_key) {
    return { configured: false, error: "GOOGLE_SERVICE_ACCOUNT_JSON must contain service_account type, client_email, and private_key." };
  }
  return { configured: true, spreadsheetId, credentials: { type: "service_account", client_email: credentials.client_email, private_key: credentials.private_key, project_id: typeof credentials.project_id === "string" ? credentials.project_id : undefined } };
}

export function googleSheetsUpsertPlan(rows: readonly (readonly string[])[], headers: readonly string[], reference: string) {
  if (!rows.length) return { writeHeaders: true, rowNumber: 2 };
  const firstRow = rows[0];
  if (firstRow.length !== headers.length || firstRow.some((value, index) => value !== headers[index])) throw new Error("Google Sheet tab headers do not match the required assignment columns.");
  const existingIndex = rows.slice(1).findIndex((row) => row[0] === reference);
  return { writeHeaders: false, rowNumber: existingIndex >= 0 ? existingIndex + 2 : rows.length + 1 };
}
