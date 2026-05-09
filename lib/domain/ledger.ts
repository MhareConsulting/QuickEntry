import type { TransactionRow, TransactionWithBalance } from "@/lib/types";

function sortKey(t: TransactionRow): [string, number, string] {
  return [t.txn_date, new Date(t.created_at).getTime(), t.id];
}

export function sortTransactionsChronological(
  rows: TransactionRow[],
): TransactionRow[] {
  return [...rows].sort((a, b) => {
    const ka = sortKey(a);
    const kb = sortKey(b);
    if (ka[0] !== kb[0]) return ka[0] < kb[0] ? -1 : 1;
    if (ka[1] !== kb[1]) return ka[1] - kb[1];
    return ka[2] < kb[2] ? -1 : 1;
  });
}

export function withRunningBalances(
  rows: TransactionRow[],
): TransactionWithBalance[] {
  const sorted = sortTransactionsChronological(rows);
  let acc = 0;
  return sorted.map((t) => {
    acc += t.type === "in" ? t.amount_cents : -t.amount_cents;
    return { ...t, running_balance_cents: acc };
  });
}

export function totalsCents(rows: TransactionRow[]): {
  receipts: number;
  payments: number;
} {
  let receipts = 0;
  let payments = 0;
  for (const t of rows) {
    if (t.type === "in") receipts += t.amount_cents;
    else payments += t.amount_cents;
  }
  return { receipts, payments };
}
