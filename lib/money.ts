/** Parses a non-negative EUR value without using binary floating point. */
export function parseEuroToCents(value: unknown): number {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) throw new Error("Enter an amount with at most two decimal places.");
  const [whole, fraction = ""] = raw.split(".");
  const cents = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new Error("Amount must be greater than zero.");
  return cents;
}

/** Parses 0-100%, preserved as basis points so shares total exactly 10,000. */
export function parsePercentageToBasisPoints(value: unknown): number {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(raw)) throw new Error("Enter a percentage from 0 to 100 with at most two decimals.");
  const [whole, fraction = ""] = raw.split(".");
  const basisPoints = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
  if (!Number.isSafeInteger(basisPoints) || basisPoints < 0 || basisPoints > 10_000) throw new Error("Each commission share must be between 0% and 100%.");
  return basisPoints;
}

export function formatEuro(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  return `${sign}€${Math.floor(absolute / 100).toLocaleString("en-IE")}.${String(absolute % 100).padStart(2, "0")}`;
}

export function formatPercentage(basisPoints: number): string {
  const text = (basisPoints / 100).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
  return `${text}%`;
}
