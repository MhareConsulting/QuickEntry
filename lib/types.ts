export type TransactionType = "in" | "out";

export type TransactionRow = {
  id: string;
  user_id: string;
  txn_date: string;
  type: TransactionType;
  category: string;
  description: string;
  amount_cents: number;
  created_at: string;
  updated_at: string;
};

export type TransactionWithBalance = TransactionRow & {
  running_balance_cents: number;
};
