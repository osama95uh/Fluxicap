"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Package,
  Pencil,
  Plus,
  TrendingDown,
  TrendingUp,
  Wheat,
} from "lucide-react";
import type {
  FeedAction,
  FeedLog,
  FormRequest,
  Mutation,
  PoultryFlock,
} from "@/lib/types";
import { LOW_FEED_THRESHOLD } from "@/lib/types";
import {
  formatBDT,
  formatShortDate,
  getFeedEstimate,
  getFeedStock,
  getLiveFlockCount,
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
} from "./ui";

type FeedFields = {
  feed_type: string;
  action_type: FeedAction;
  quantity: string;
  cost: string;
  date: string;
};

function previousOf(log: FeedLog) {
  return {
    feed_type: log.feed_type,
    action_type: log.action_type,
    cost: log.cost,
    log_date: log.log_date,
  };
}

export default function FeedInventory({
  feedLogs,
  flocks,
  onMutate,
  formRequest,
}: {
  feedLogs: FeedLog[];
  flocks: PoultryFlock[];
  onMutate: (mutation: Mutation) => Promise<void>;
  formRequest?: FormRequest;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [action, setAction] = useState<FeedAction>("purchase");
  const [feedType, setFeedType] = useState("Layer feed");
  const [quantity, setQuantity] = useState("");
  const [cost, setCost] = useState("");
  const [date, setDate] = useState(toISODate(new Date()));
  const [error, setError] = useState("");

  const [edit, setEdit] = useState<(FeedFields & { id: string }) | null>(null);
  const [editError, setEditError] = useState("");

  useEffect(() => {
    if (formRequest?.target === "feed") {
      setError("");
      setShowAdd(true);
    }
  }, [formRequest?.nonce]);

  const stock = getFeedStock(feedLogs);
  const hasLogs = feedLogs.length > 0;
  const lowStock = hasLogs && stock < LOW_FEED_THRESHOLD;
  const birdCount = getLiveFlockCount(flocks);
  const estimate = getFeedEstimate(feedLogs, birdCount);

  function validateFields(fields: FeedFields, availableStock: number): string | null {
    const kg = Number(fields.quantity);
    const totalCost = Number(fields.cost);
    if (!fields.feed_type.trim()) return "Enter a feed type.";
    if (!Number.isFinite(kg) || kg <= 0) return "Quantity must be greater than 0.";
    if (fields.action_type === "purchase" && (!Number.isFinite(totalCost) || totalCost <= 0)) {
      return "Enter the purchase cost in BDT.";
    }
    if (fields.action_type === "consume" && kg > availableStock) {
      return `Only ${availableStock.toLocaleString()} kg available in stock.`;
    }
    return null;
  }

  function resetAddForm() {
    setAction("purchase");
    setFeedType("Layer feed");
    setQuantity("");
    setCost("");
    setDate(toISODate(new Date()));
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateFields({ feed_type: feedType, action_type: action, quantity, cost, date }, stock);
    if (validation) return setError(validation);
    setError("");

    await onMutate({
      kind: "addFeedLog",
      payload: {
        feed_type: feedType.trim(),
        action_type: action,
        quantity_kg: Number(quantity),
        cost: action === "purchase" ? Number(cost) : null,
        log_date: date || toISODate(new Date()),
        createExpense: action === "purchase",
      },
    });
    resetAddForm();
    setShowAdd(false);
  }

  function openEdit(log: FeedLog) {
    setEditError("");
    setEdit({
      id: log.id,
      feed_type: log.feed_type,
      action_type: log.action_type,
      quantity: String(log.quantity_kg),
      cost: log.cost === null ? "" : String(log.cost),
      date: log.log_date,
    });
  }

  async function handleEdit() {
    if (!edit) return;
    const original = feedLogs.find((log) => log.id === edit.id);
    if (!original) return;
    const availableStock = stock + (original.action_type === "consume" ? Number(original.quantity_kg) : 0);
    const validation = validateFields(edit, availableStock);
    if (validation) return setEditError(validation);
    setEditError("");

    await onMutate({
      kind: "editFeedLog",
      id: edit.id,
      previous: previousOf(original),
      payload: {
        feed_type: edit.feed_type.trim(),
        action_type: edit.action_type,
        quantity_kg: Number(edit.quantity),
        cost: edit.action_type === "purchase" ? Number(edit.cost) : null,
        log_date: edit.date || toISODate(new Date()),
      },
    });
    setEdit(null);
  }

  return (
    <>
      <Card>
        <SectionHeader
          icon={Wheat}
          title="Feed Stock & Inventory"
          subtitle="Purchases, consumption and low-stock alerts"
          action={
            <div className="flex items-center gap-2">
              {!hasLogs ? (
                <Badge tone="slate">No feed yet</Badge>
              ) : lowStock ? (
                <Badge tone="amber">
                  <AlertTriangle className="h-3 w-3" /> Low
                </Badge>
              ) : (
                <Badge tone="green">Stock OK</Badge>
              )}
              <Button onClick={() => { resetAddForm(); setShowAdd(true); }} className="px-3 sm:px-4">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Log feed</span>
              </Button>
            </div>
          }
        />

        <div className="p-4 sm:p-5 md:p-6">
          <div
            className={`rounded-2xl p-4 shadow-sm sm:p-5 ${
              !hasLogs
                ? "bg-gradient-to-br from-slate-50 to-slate-100/70 ring-1 ring-slate-200"
                : lowStock
                  ? "bg-gradient-to-br from-amber-50 to-orange-50/70 ring-1 ring-amber-200"
                  : "bg-gradient-to-br from-emerald-50 to-teal-100/50 ring-1 ring-emerald-100"
            }`}
          >
            <p
              className={`text-xs font-bold uppercase tracking-wide ${
                !hasLogs ? "text-slate-500" : lowStock ? "text-amber-700" : "text-emerald-700"
              }`}
            >
              Feed remaining
            </p>
            <p
              className={`mt-1 text-3xl font-extrabold tabular-nums ${
                !hasLogs ? "text-slate-700" : lowStock ? "text-amber-700" : "text-emerald-800"
              }`}
            >
              {stock.toLocaleString()} <span className="text-xl font-bold">kg</span>
            </p>
            {!hasLogs ? (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <Package className="h-3.5 w-3.5" />
                No feed logged yet — record a purchase to start tracking stock.
              </p>
            ) : lowStock ? (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5" />
                Under {LOW_FEED_THRESHOLD} kg — arrange a purchase soon.
              </p>
            ) : (
              <p className="mt-1 text-xs text-emerald-700/80">
                Warning starts below {LOW_FEED_THRESHOLD} kg.
              </p>
            )}
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50/80 p-3.5 ring-1 ring-slate-200/70 sm:p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Est. daily use
              </p>
              <p className="mt-1 text-lg font-extrabold text-slate-800 tabular-nums">
                {estimate.hasConsumption ? `${estimate.dailyKg.toFixed(1)} kg` : "—"}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400 tabular-nums">
                {estimate.perBirdGrams !== null
                  ? `${Math.round(estimate.perBirdGrams)} g per bird / day`
                  : "Add an active flock for per-bird use"}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50/80 p-3.5 ring-1 ring-slate-200/70 sm:p-4">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                <Clock3 className="h-3.5 w-3.5 shrink-0" />
                <span>Stock days left</span>
              </p>
              <p className="mt-1 text-lg font-extrabold text-slate-800 tabular-nums">
                {estimate.daysLeft === null ? "—" : estimate.daysLeft > 365 ? ">365 days" : `${estimate.daysLeft} days`}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400 tabular-nums">
                Based on {estimate.windowDays}-day use · {birdCount} birds
              </p>
            </div>
          </div>

          <div className="mt-5 border-t border-slate-100 pt-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">
              <Package className="h-3.5 w-3.5 shrink-0" />
              <span>Recent feed activity</span>
            </p>
            {feedLogs.length === 0 ? (
              <EmptyState icon={Package} title="No feed logs yet" description="Log a purchase or consumption to see your stock change." />
            ) : (
              <div className="space-y-2">
                {feedLogs.slice(0, 8).map((log) => (
                  <div key={log.id} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-700">{log.feed_type}</p>
                        <p className="text-xs text-slate-400 tabular-nums">
                          {formatShortDate(log.log_date)}
                          {log.action_type === "purchase" && log.cost ? ` · ${formatBDT(log.cost)}` : ""}
                        </p>
                      </div>
                      <Badge tone={log.action_type === "purchase" ? "green" : "amber"}>
                        {log.action_type === "purchase" ? "+" : "−"}{log.quantity_kg} kg
                      </Badge>
                      <IconButton label="Edit feed log" onClick={() => openEdit(log)}>
                        <Pencil className="h-4 w-4" />
                      </IconButton>
                      <ConfirmButton
                        title="Delete feed log"
                        onConfirm={() =>
                          onMutate({ kind: "deleteFeedLog", id: log.id, previous: previousOf(log) })
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="Log feed"
        description="Purchases are also recorded as a Feed expense."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100/80 p-1 ring-1 ring-slate-200/60">
            {(["purchase", "consume"] as FeedAction[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => { setAction(item); setError(""); }}
                className={`min-h-11 rounded-xl text-sm font-bold capitalize transition-all active:scale-[0.98] ${
                  action === item ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {item === "purchase" ? "Purchase" : "Consume"}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Feed type">
              <Input list="feed-types" value={feedType} onChange={(e) => setFeedType(e.target.value)} placeholder="e.g. Layer feed" />
              <datalist id="feed-types">
                <option value="Layer feed" />
                <option value="Broiler feed" />
                <option value="Duck feed" />
                <option value="Starter feed" />
              </datalist>
            </Field>
            <Field label="Quantity (kg)">
              <Input type="number" min={0.1} step="0.1" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" required />
            </Field>
            {action === "purchase" ? (
              <Field label="Cost (৳)" hint="Also recorded as a Feed expense.">
                <Input type="number" min={0} step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" required />
              </Field>
            ) : (
              <Field label="Available stock" hint="Consumption cannot exceed this.">
                <Input value={`${stock.toLocaleString()} kg`} readOnly />
              </Field>
            )}
            <Field label="Date">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </Field>
          </div>

          {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
          <div className="flex gap-2">
            <Button type="submit" className="flex-1">
              {action === "purchase" ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {action === "purchase" ? "Log purchase" : "Log consumption"}
            </Button>
            <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(edit)}
        onClose={() => setEdit(null)}
        title="Edit feed log"
        description="Linked feed expenses are updated automatically."
      >
        {edit ? (
          <form
            onSubmit={(event) => { event.preventDefault(); void handleEdit(); }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100/80 p-1 ring-1 ring-slate-200/60">
              {(["purchase", "consume"] as FeedAction[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setEdit({ ...edit, action_type: item })}
                  className={`min-h-11 rounded-xl text-sm font-bold capitalize transition-all active:scale-[0.98] ${
                    edit.action_type === item
                      ? "bg-white text-emerald-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Feed type">
                <Input value={edit.feed_type} onChange={(e) => setEdit({ ...edit, feed_type: e.target.value })} />
              </Field>
              <Field label="Quantity (kg)">
                <Input type="number" min={0.1} step="0.1" value={edit.quantity} onChange={(e) => setEdit({ ...edit, quantity: e.target.value })} />
              </Field>
              {edit.action_type === "purchase" ? (
                <Field label="Cost (৳)">
                  <Input type="number" min={0} step="0.01" value={edit.cost} onChange={(e) => setEdit({ ...edit, cost: e.target.value })} />
                </Field>
              ) : null}
              <Field label="Date">
                <Input type="date" value={edit.date} onChange={(e) => setEdit({ ...edit, date: e.target.value })} />
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
