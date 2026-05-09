"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { TransactionRow, TransactionType } from "@/lib/types";
import { totalsCents, withRunningBalances } from "@/lib/domain/ledger";
import { formatCents, parseMoneyToCents } from "@/lib/domain/money";
import {
  CATEGORIES,
  categoryBadgeClass,
  categoryLabel,
} from "@/lib/domain/categories";

type LedgerAppProps = {
  userEmail: string | null;
};

const supabaseReady =
  typeof process.env.NEXT_PUBLIC_SUPABASE_URL === "string" &&
  process.env.NEXT_PUBLIC_SUPABASE_URL.length > 0 &&
  typeof process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === "string" &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length > 0;

export function LedgerApp({ userEmail }: LedgerAppProps) {
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [txnDate, setTxnDate] = useState("");
  const [txnType, setTxnType] = useState<TransactionType>("out");
  const [txnCategory, setTxnCategory] = useState<string>(CATEGORIES[0].id);
  const [txnAmount, setTxnAmount] = useState("");
  const [txnDescription, setTxnDescription] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);

  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const resetForm = () => {
    const today = new Date().toISOString().slice(0, 10);
    setTxnDate(today);
    setTxnType("out");
    setTxnCategory(CATEGORIES[0].id);
    setTxnAmount("");
    setTxnDescription("");
    setEditingId(null);
  };

  const openModalForNew = () => {
    resetForm();
    setModalOpen(true);
  };

  const openModalForEdit = (row: TransactionRow) => {
    setEditingId(row.id);
    setTxnDate(row.txn_date);
    setTxnType(row.type);
    const nextCat = CATEGORIES.some((c) => c.id === row.category)
      ? row.category
      : CATEGORIES[0].id;
    setTxnCategory(nextCat);
    setTxnAmount((row.amount_cents / 100).toFixed(2));
    setTxnDescription(row.description);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
  };

  const fetchTransactions = useCallback(async (): Promise<{
    rows: TransactionRow[];
    error: string | null;
  }> => {
    if (!supabaseReady) {
      return {
        rows: [],
        error: "Configure Supabase environment variables.",
      };
    }
    const supabase = createClient();
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .order("txn_date", { ascending: true })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    if (error) return { rows: [], error: error.message };
    return { rows: (data ?? []) as TransactionRow[], error: null };
  }, []);

  const refreshRows = useCallback(async () => {
    const { rows, error } = await fetchTransactions();
    setRows(rows);
    setLoadError(error);
  }, [fetchTransactions]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { rows, error } = await fetchTransactions();
      if (cancelled) return;
      setRows(rows);
      setLoadError(error);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchTransactions]);

  useEffect(() => {
    if (!modalOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [modalOpen]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((t) => {
      if (categoryFilter && t.category !== categoryFilter) return false;
      if (!q) return true;
      const desc = t.description.toLowerCase();
      const cat = categoryLabel(t.category).toLowerCase();
      return (
        desc.includes(q) ||
        cat.includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    });
  }, [rows, search, categoryFilter]);

  const withBal = useMemo(
    () => withRunningBalances(filtered),
    [filtered],
  );

  const stats = useMemo(() => {
    const { receipts, payments } = totalsCents(filtered);
    const lastBal =
      withBal.length > 0
        ? withBal[withBal.length - 1].running_balance_cents
        : 0;
    return {
      receipts,
      payments,
      entries: filtered.length,
      filteredBalance: lastBal,
    };
  }, [filtered, withBal]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!supabaseReady) return;
    const cents = parseMoneyToCents(txnAmount);
    if (cents == null) {
      showToast("Enter a positive amount like 45.50");
      return;
    }
    setSaveBusy(true);
    const supabase = createClient();
    const payload = {
      txn_date: txnDate,
      type: txnType,
      category: txnCategory,
      description: txnDescription.trim(),
      amount_cents: cents,
    };
    try {
      if (editingId) {
        const { error } = await supabase
          .from("transactions")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("transactions").insert(payload);
        if (error) throw error;
      }
      showToast(editingId ? "Transaction updated" : "Transaction added");
      setModalOpen(false);
      resetForm();
      await refreshRows();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      showToast(msg);
    } finally {
      setSaveBusy(false);
    }
  }

  async function handleDelete() {
    if (!editingId || !supabaseReady) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm("Delete this transaction? This cannot be undone.")
    )
      return;
    setSaveBusy(true);
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", editingId);
      if (error) throw error;
      showToast("Transaction deleted");
      setModalOpen(false);
      resetForm();
      await refreshRows();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Delete failed";
      showToast(msg);
    } finally {
      setSaveBusy(false);
    }
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  async function exportFilteredXlsx() {
    if (!withBal.length) {
      showToast("Nothing to export for the current filters");
      return;
    }
    const mod = await import("@linways/table-to-excel");
    const TableToExcel = mod.default;
    const table = document.createElement("table");
    table.id = "hidden-export-table";
    table.style.display = "none";

    const thead = document.createElement("thead");
    const hr = document.createElement("tr");
    const headers = [
      "Date",
      "Description",
      "Category",
      "Receipts",
      "Payments",
      "Balance",
    ];
    headers.forEach((h) => {
      const th = document.createElement("th");
      th.textContent = h;
      hr.appendChild(th);
    });
    thead.appendChild(hr);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    for (const row of withBal) {
      const tr = document.createElement("tr");

      const tdDate = document.createElement("td");
      tdDate.textContent = row.txn_date;
      tdDate.setAttribute("data-t", "d");
      tr.appendChild(tdDate);

      const tdDesc = document.createElement("td");
      tdDesc.textContent = row.description;
      tr.appendChild(tdDesc);

      const tdCat = document.createElement("td");
      tdCat.textContent = categoryLabel(row.category);
      tr.appendChild(tdCat);

      const tdIn = document.createElement("td");
      if (row.type === "in") {
        tdIn.textContent = String(row.amount_cents / 100);
        tdIn.setAttribute("data-t", "n");
        tdIn.setAttribute("data-num-fmt", "#,##0.00");
      }
      tr.appendChild(tdIn);

      const tdOut = document.createElement("td");
      if (row.type === "out") {
        tdOut.textContent = String(row.amount_cents / 100);
        tdOut.setAttribute("data-t", "n");
        tdOut.setAttribute("data-num-fmt", "#,##0.00");
      }
      tr.appendChild(tdOut);

      const tdBal = document.createElement("td");
      tdBal.textContent = String(row.running_balance_cents / 100);
      tdBal.setAttribute("data-t", "n");
      tdBal.setAttribute("data-num-fmt", "#,##0.00");
      tr.appendChild(tdBal);

      tbody.appendChild(tr);
    }
    table.appendChild(tbody);

    document.body.appendChild(table);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    try {
      TableToExcel.convert(table, {
        name: `quickentry-${stamp}.xlsx`,
        sheet: { name: "Cashbook Ledger" },
      });
    } finally {
      window.setTimeout(() => {
        table.remove();
      }, 500);
    }
    showToast("Export started");
  }

  return (
    <div className="app">
      <header className="header">
        <div className="logo">
          <div className="logo-box" aria-hidden>
            <svg viewBox="0 0 24 24">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 4l5 2.18V11c0 3.5-2.33 6.79-5 7.93-2.67-1.14-5-4.43-5-7.93V7.18L12 5z" />
            </svg>
          </div>
          <span className="logo-name">
            QUICK<span>ENTRY</span>
          </span>
        </div>
        <div className="hdr-r">
          {userEmail ? (
            <>
              <span className="dbadge" title={userEmail}>
                {userEmail}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  handleLogout().catch(() =>
                    showToast("Sign out failed"),
                  )
                }
              >
                Sign out
              </button>
            </>
          ) : null}
        </div>
      </header>

      <main className="content">
        {!supabaseReady ? (
          <p className="empty-hint">
            Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to <code>.env.local</code>{" "}
            and restart the dev server.
          </p>
        ) : null}

        {loadError ? (
          <p className="empty-hint" style={{ borderStyle: "solid" }}>
            Could not load transactions: {loadError}. Run the migration in{" "}
            <code>supabase/migrations</code> (see README inside project).
          </p>
        ) : null}

        <div className="stats-row">
          <div className="sc green">
            <div className="sc-lbl">Receipts (filtered)</div>
            <div className="sc-val">{formatCents(stats.receipts)}</div>
            <div className="sc-sub">Inflows in view</div>
          </div>
          <div className="sc red">
            <div className="sc-lbl">Payments (filtered)</div>
            <div className="sc-val">{formatCents(stats.payments)}</div>
            <div className="sc-sub">Outflows in view</div>
          </div>
          <div className="sc blue">
            <div className="sc-lbl">Running balance</div>
            <div className="sc-val">
              {formatCents(stats.filteredBalance)}
            </div>
            <div className="sc-sub">Chronological, filtered list</div>
          </div>
          <div className="sc amber">
            <div className="sc-lbl">Entries</div>
            <div className="sc-val">{stats.entries}</div>
            <div className="sc-sub">Rows in view</div>
          </div>
        </div>

        <div className="sec-hdr">
          <h2 className="sec-ttl">Ledger</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() =>
                exportFilteredXlsx().catch(() =>
                  showToast("Export failed"),
                )
              }
              disabled={!supabaseReady || loading}
            >
              Export Excel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={openModalForNew}
              disabled={!supabaseReady}
            >
              New transaction
            </button>
          </div>
        </div>

        <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>
          Tip: Export regularly — it doubles as backup. Amounts stay exact using
          cent precision in Postgres.
        </p>

        <div className="fbar">
          <input
            type="search"
            className="si"
            placeholder="Search description or category…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search transactions"
          />
          <button
            type="button"
            className={`fb ${categoryFilter === null ? "active" : ""}`}
            onClick={() => setCategoryFilter(null)}
          >
            All
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`fb ${categoryFilter === c.id ? "active" : ""}`}
              onClick={() =>
                setCategoryFilter(categoryFilter === c.id ? null : c.id)
              }
            >
              {c.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="empty-hint">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="empty-hint">
            No transactions yet. Start with &quot;New transaction&quot; — or widen
            your filters.
          </div>
        ) : (
          <div className="jgrid">
            {withBal.map((row) => (
              <article
                key={row.id}
                className="jcard"
                role="button"
                tabIndex={0}
                onClick={() => openModalForEdit(row)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter" || ev.key === " ")
                    openModalForEdit(row);
                }}
              >
                <div
                  className={`jpri ${row.type}`}
                  aria-hidden
                  title={row.type === "in" ? "Receipt" : "Payment"}
                />
                <div className="jmain">
                  <div className="jttl">{row.description || "—"}</div>
                  <div className="jmeta">
                    <span>{row.txn_date}</span>
                    <span>{row.type === "in" ? "Receipt" : "Payment"}</span>
                    <span
                      className={`bdg ${categoryBadgeClass(row.category)}`}
                      title={row.category}
                    >
                      {categoryLabel(row.category)}
                    </span>
                  </div>
                </div>
                <div className="jright">
                  <span
                    className={`jamt ${row.type}`}
                    title="Transaction amount"
                  >
                    {row.type === "in" ? "+" : "−"}
                    {formatCents(row.amount_cents)}
                  </span>
                  <span className="jbal" title="Running balance after this row">
                    Bal {formatCents(row.running_balance_cents)}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      <div
        className={`mo ${modalOpen ? "open" : ""}`}
        role="presentation"
        onClick={closeModal}
      >
        <div
          className="md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="txn-modal-title"
          onClick={(ev) => ev.stopPropagation()}
        >
          <div className="mhdr">
            <div>
              <h3 className="mttl" id="txn-modal-title">
                {editingId ? "Edit transaction" : "New transaction"}
              </h3>
              <div className="msub">
                Dates use ISO ordering; amounts are stored in cents.
              </div>
            </div>
            <button
              type="button"
              className="mclose"
              onClick={closeModal}
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSave}>
            <div className="mbdy">
              <div className="igrid">
                <div className="fg">
                  <label className="fl" htmlFor="txn-date">
                    Date
                  </label>
                  <input
                    id="txn-date"
                    className="fi"
                    type="date"
                    required
                    value={txnDate}
                    onChange={(e) => setTxnDate(e.target.value)}
                  />
                </div>
                <div className="fg">
                  <span className="fl">Type</span>
                  <div className="type-toggle">
                    <button
                      type="button"
                      className={`${txnType === "in" ? "active-in" : ""}`}
                      onClick={() => setTxnType("in")}
                    >
                      Receipt
                    </button>
                    <button
                      type="button"
                      className={`${txnType === "out" ? "active-out" : ""}`}
                      onClick={() => setTxnType("out")}
                    >
                      Payment
                    </button>
                  </div>
                </div>
              </div>
              <div className="igrid">
                <div className="fg">
                  <label className="fl" htmlFor="txn-cat">
                    Category
                  </label>
                  <select
                    id="txn-cat"
                    className="fsel"
                    value={txnCategory}
                    onChange={(e) => setTxnCategory(e.target.value)}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="fg">
                  <label className="fl" htmlFor="txn-amt">
                    Amount
                  </label>
                  <input
                    id="txn-amt"
                    className="fi"
                    inputMode="decimal"
                    placeholder="e.g. 45.50"
                    value={txnAmount}
                    onChange={(e) => setTxnAmount(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="fg">
                <label className="fl" htmlFor="txn-desc">
                  Description
                </label>
                <textarea
                  id="txn-desc"
                  className="ftxt"
                  rows={3}
                  value={txnDescription}
                  onChange={(e) => setTxnDescription(e.target.value)}
                  placeholder="What was bought or paid"
                />
              </div>
            </div>

            <div className="mftr">
              {editingId ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ marginRight: "auto", color: "var(--danger-tx)" }}
                  onClick={() => handleDelete()}
                  disabled={saveBusy}
                >
                  Delete
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn-ghost"
                onClick={closeModal}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saveBusy}
              >
                {saveBusy ? "Saving…" : editingId ? "Save changes" : "Add"}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div
        className={`toast ${toast ? "show" : ""}`}
        role="status"
        aria-live="polite"
      >
        {toast}
      </div>
    </div>
  );
}
