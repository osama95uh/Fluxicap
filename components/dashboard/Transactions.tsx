"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Pencil,
  PieChart,
  Plus,
  Receipt,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type {
  FarmTransaction,
  FormRequest,
  Mutation,
  TransactionType,
} from "@/lib/types";
import {
  formatBDT,
  formatShortDate,
  getExpenseBreakdown,
  getMonthTotals,
  toISODate,
} from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  ConfirmButton,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  SectionHeader,
  Select,
} from "./ui";

const CATEGORIES: Record<TransactionType, string[]> = {
  income: ["Egg Sales", "Chick Sales", "Flock Sales", "Other Income"],
  expense: ["Feed", "Medicine", "Chicks", "Utilities", "Labor", "Transport", "Other Expense"],
};

type TransactionFields = {
  type: TransactionType;
  category: string;
  amount: string;
  date: string;
  description: string;
};

export default function Transactions({
  transactions,
  onMutate,
  formRequest,
}: {
  transactions: FarmTransaction[];
  onMutate: (mutation: Mutation) => Promise<void>;
  formRequest?: FormRequest;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [type, setType] = useState<TransactionType>("income");
  const [category, setCategory] = useState(CATEGORIES.income[0]);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(toISODate(new Date()));
  const [error, setError] = useState("");

  const [edit, setEdit] = useState<(TransactionFields & { id: string }) | null>(null);
  const [editError, setEditError] = useState("");

  useEffect(() => {
    if (formRequest?.target === "transaction") {
      setError("");
      setShowAdd(true);
    }
  }, [formRequest?.nonce]);

  const { income, expense, net } = getMonthTotals(transactions);
  const breakdown = getExpenseBreakdown(transactions);

  function resetAddForm() {
    setType("income");
    setCategory(CATEGORIES.income[0]);
    setAmount("");
    setDescription("");
    setDate(toISODate(new Date()));
    setError("");
  }

  function changeType(next: TransactionType) {
    setType(next);
    setCategory(CATEGORIES[next][0]);
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return setError("Enter an amount greater than 0.");
    if (!category) return setError("Choose a category.");

    await onMutate({
      kind: "addTransaction",
      payload: {
        type,
        category,
        amount: value,
        description: description.trim() || null,
        transaction_date: date || toISODate(new Date()),
      },
    });
    resetAddForm();
    setShowAdd(false);
  }

  function openEdit(transaction: FarmTransaction) {
    setEditError("");
    setEdit({
      id: transaction.id,
      type: transaction.type,
      category: transaction.category,
      amount: String(transaction.amount),
      date: transaction.transaction_date,
      description: transaction.description ?? "",
    });
  }

  async function handleEdit() {
    if (!edit) return;
    setEditError("");
    const value = Number(edit.amount);
    if (!Number.isFinite(value) || value <= 0) return setEditError("Enter an amount greater than 0.");

    await onMutate({
      kind: "editTransaction",
      id: edit.id,
      payload: {
        type: edit.type,
        category: edit.category,
        amount: value,
        description: edit.description.trim() || null,
        transaction_date: edit.date || toISODate(new Date()),
      },
    });
    setEdit(null);
  }

  return (
    <>
      <Card>
        <SectionHeader
          icon={Wallet}
          title="Income & Expense"
          subtitle="All amounts in Bangladeshi Taka (৳)"
          action={
            <div className="flex items-center gap-2">
              <Badge tone={net >= 0 ? "green" : "red"}>{formatBDT(net)}</Badge>
              <Button onClick={() => { resetAddForm(); setShowAdd(true); }} className="px-3 sm:px-4">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Add entry</span>
              </Button>
            </div>
          }
        />

        <div className="p-4 sm:p-5 md:p-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100/60 p-3.5 ring-1 ring-emerald-100 sm:p-4">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                <TrendingUp className="h-3.5 w-3.5" /> Income
              </p>
              <p className="mt-1 text-lg font-extrabold text-emerald-700 tabular-nums">{formatBDT(income)}</p>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-red-50 to-rose-50 p-3.5 ring-1 ring-red-100 sm:p-4">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-red-600">
                <TrendingDown className="h-3.5 w-3.5" /> Expense
              </p>
              <p className="mt-1 text-lg font-extrabold text-red-600 tabular-nums">{formatBDT(expense)}</p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-3.5 shadow-sm sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
                <PieChart className="h-3.5 w-3.5" /> Expense by category
              </p>
              <span className="text-[11px] font-semibold text-slate-400 tabular-nums">
                {formatBDT(breakdown.total)} this month
              </span>
            </div>
            {breakdown.rows.length === 0 ? (
              <p className="py-4 text-center text-xs text-slate-400">No expenses recorded this month.</p>
            ) : (
              <div className="mt-3 space-y-2.5">
                {breakdown.rows.map((row) => (
                  <div key={row.category}>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-slate-700">{row.category}</span>
                      <span className="font-bold text-slate-700 tabular-nums">
                        {formatBDT(row.amount)} · {row.percent}%
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-white shadow-inner">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-400 to-red-400"
                        style={{ width: `${row.percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-5 border-t border-slate-100 pt-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">
              <Receipt className="h-3.5 w-3.5" /> Recent transactions
            </p>
            {transactions.length === 0 ? (
              <EmptyState icon={Receipt} title="No transactions yet" description="Add income or expense entries to see them here." />
            ) : (
              <div className="divide-y divide-slate-100">
                {transactions.slice(0, 12).map((transaction) => {
                  const isIncome = transaction.type === "income";
                  return (
                    <div key={transaction.id} className="flex min-h-[60px] items-center gap-3 py-3">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${isIncome ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
                        {isIncome ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800">{transaction.category}</p>
                        <p className="truncate text-xs text-slate-400 tabular-nums">
                          {transaction.description || (isIncome ? "Income" : "Expense")} · {formatShortDate(transaction.transaction_date)}
                        </p>
                      </div>
                      <p className={`shrink-0 text-sm font-extrabold tabular-nums ${isIncome ? "text-emerald-600" : "text-red-600"}`}>
                        {isIncome ? "+" : "−"}{formatBDT(transaction.amount)}
                      </p>
                      <IconButton label="Edit transaction" onClick={() => openEdit(transaction)}>
                        <Pencil className="h-4 w-4" />
                      </IconButton>
                      <ConfirmButton
                        title="Delete transaction"
                        onConfirm={() => onMutate({ kind: "deleteTransaction", id: transaction.id })}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Card>

      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="Add transaction"
        description="Record income or an expense in Bangladeshi Taka."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100/80 p-1 ring-1 ring-slate-200/60">
            {(["income", "expense"] as TransactionType[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => changeType(item)}
                className={`min-h-11 rounded-xl text-sm font-bold capitalize transition-all active:scale-[0.98] ${
                  type === item
                    ? item === "income"
                      ? "bg-white text-emerald-700 shadow-sm"
                      : "bg-white text-red-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {item === "income" ? "＋ Income" : "− Expense"}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Category">
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES[type].map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </Select>
            </Field>
            <Field label="Amount (৳)">
              <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" required />
            </Field>
            <Field label="Date">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </Field>
            <Field label="Description (optional)">
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Weekly egg sale" />
            </Field>
          </div>

          {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
          <div className="flex gap-2">
            <Button type="submit" variant={type === "income" ? "primary" : "danger"} className="flex-1">
              Add {type}
            </Button>
            <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(edit)}
        onClose={() => setEdit(null)}
        title="Edit transaction"
        description="Fix the category, amount, date or description."
      >
        {edit ? (
          <form
            onSubmit={(event) => { event.preventDefault(); void handleEdit(); }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100/80 p-1 ring-1 ring-slate-200/60">
              {(["income", "expense"] as TransactionType[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setEdit({ ...edit, type: item, category: CATEGORIES[item][0] })}
                  className={`min-h-11 rounded-xl text-sm font-bold capitalize transition-all active:scale-[0.98] ${
                    edit.type === item
                      ? "bg-white text-emerald-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Category">
                <Select value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })}>
                  {CATEGORIES[edit.type].map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Amount (৳)">
                <Input type="number" min={0} step="0.01" value={edit.amount} onChange={(e) => setEdit({ ...edit, amount: e.target.value })} />
              </Field>
              <Field label="Date">
                <Input type="date" value={edit.date} onChange={(e) => setEdit({ ...edit, date: e.target.value })} />
              </Field>
              <Field label="Description (optional)">
                <Input value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
              </Field>
            </div>
            {editError ? <p className="text-sm font-medium text-red-600">{editError}</p> : null}
            <div className="flex gap-2">
              <Button type="submit" className="flex-1">
                <CheckCircle2 className="h-4 w-4" /> Save changes
              </Button>
              <Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button>
            </div>
          </form>
        ) : null}
      </Modal>
    </>
  );
}
