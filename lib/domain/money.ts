const CENTS = 100;

export function parseMoneyToCents(input: string): number | null {
  const s = input.trim().replace(/,/g, "");
  if (s === "") return null;
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return null;
  const parts = s.split(".");
  const whole = parts[0] ?? "0";
  let frac = parts[1] ?? "";
  if (frac.length === 0) frac = "00";
  if (frac.length === 1) frac = `${frac}0`;
  if (frac.length > 2) return null;
  const w = BigInt(whole);
  const f = BigInt(frac.padEnd(2, "0"));
  const cents = w * BigInt(CENTS) + f;
  const asNum = Number(cents);
  if (!Number.isSafeInteger(asNum)) return null;
  if (asNum <= 0) return null;
  return asNum;
}

export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / CENTS);
  const sub = abs % CENTS;
  return `${sign}${dollars.toLocaleString(undefined, { maximumFractionDigits: 0 })}.${String(sub).padStart(2, "0")}`;
}

export function centsToDisplayNumber(cents: number): number {
  return Math.round(cents) / CENTS;
}
