"use client";

import {
  AlertTriangle,
  ArrowRight,
  Bird,
  CheckCircle2,
  Egg,
  Plus,
  Receipt,
  Syringe,
  Wallet,
  Wheat,
  Zap,
} from "lucide-react";
import {
  EGG_CAPACITY,
  LOW_FEED_THRESHOLD,
  type FarmData,
  type FormRequest,
  type PageId,
} from "@/lib/types";
import {
  formatBDT,
  formatShortDate,
  getBatchProgress,
  getFeedStock,
} from "@/lib/utils";
import SummaryCards from "./SummaryCards";
import { Badge, Card, EmptyState } from "./ui";

type Alert = {
  tone: "amber" | "sky" | "green";
  title: string;
  detail: string;
  page: PageId;
};

export default function Overview({
  data,
  onNavigate,
  onQuickAction,
}: {
  data: FarmData;
  onNavigate: (page: PageId) => void;
  onQuickAction: (request: NonNullable<FormRequest>) => void;
}) {
  const activeBatches = data.batches.filter((batch) => batch.status === "active");
  const lockdown = activeBatches.filter((batch) => getBatchProgress(batch).isLockdown);
  const hatching = activeBatches.filter((batch) => getBatchProgress(batch).isHatching);
  const feedStock = getFeedStock(data.feedLogs);
  const lowFeed = feedStock < LOW_FEED_THRESHOLD;
  const usedEggs = activeBatches.reduce((sum, batch) => sum + Number(batch.total_eggs || 0), 0);

  const today = new Date().toISOString().slice(0, 10);
  const upcomingCare = data.flockLogs.filter(
    (log) => log.vaccine_or_medicine?.trim() && log.log_date > today,
  ).length;

  const alerts: Alert[] = [];
  for (const batch of lockdown) {
    const progress = getBatchProgress(batch);
    alerts.push({
      tone: "amber",
      title: `${batch.batch_name} is in lockdown`,
      detail: `Day ${progress.currentDay}/${progress.spec.cycleDays} · keep the incubator closed until hatch.`,
      page: "incubator",
    });
  }
  for (const batch of hatching) {
    alerts.push({
      tone: "green",
      title: `${batch.batch_name} is ready to hatch`,
      detail: "Update hatch counts, then move the chicks into a new flock.",
      page: "incubator",
    });
  }
  if (lowFeed) {
    alerts.push({
      tone: "amber",
      title: "Feed stock is running low",
      detail: `${feedStock.toLocaleString()} kg remaining — below the ${LOW_FEED_THRESHOLD} kg warning level.`,
      page: "feed",
    });
  }
  if (upcomingCare > 0) {
    alerts.push({
      tone: "sky",
      title: `${upcomingCare} care ${upcomingCare === 1 ? "note is" : "notes are"} scheduled`,
      detail: "Check the flock care schedule for upcoming vaccines and medicine.",
      page: "flocks",
    });
  }
  if (usedEggs >= EGG_CAPACITY) {
    alerts.push({
      tone: "amber",
      title: "Incubator is at capacity",
      detail: `${usedEggs} of ${EGG_CAPACITY} egg slots are in use.`,
      page: "incubator",
    });
  }

  const quickActions = [
    {
      label: "Start a batch",
      detail: "Set eggs & dates",
      icon: Egg,
      target: "batch" as const,
      page: "incubator" as const,
      color: "bg-amber-50 text-amber-700",
    },
    {
      label: "Add flock",
      detail: "New bird group",
      icon: Bird,
      target: "flock" as const,
      page: "flocks" as const,
      color: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Log feed",
      detail: "Purchase or use",
      icon: Wheat,
      target: "feed" as const,
      page: "feed" as const,
      color: "bg-lime-50 text-lime-700",
    },
    {
      label: "Add money",
      detail: "Income or cost",
      icon: Wallet,
      target: "transaction" as const,
      page: "finance" as const,
      color: "bg-sky-50 text-sky-700",
    },
  ];

  return (
    <div className="space-y-5 sm:space-y-6">
      <SummaryCards data={data} />

      <Card>
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5 md:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-100">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <h2 className="text-sm font-bold tracking-tight text-slate-900">Needs attention</h2>
          </div>
          {alerts.length > 0 ? (
            <Badge tone="amber">{alerts.length} alerts</Badge>
          ) : (
            <Badge tone="green">
              <CheckCircle2 className="h-3 w-3" /> All clear
            </Badge>
          )}
        </div>
        {alerts.length === 0 ? (
          <div className="p-3 sm:p-4">
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-4 text-sm text-emerald-800">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
              Nothing urgent right now. Keep an eye on your batches and feed stock.
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {alerts.map((alert) => {
              const Icon = alert.tone === "amber" ? AlertTriangle : alert.tone === "sky" ? Syringe : CheckCircle2;
              return (
                <button
                  key={`${alert.page}-${alert.title}`}
                  type="button"
                  onClick={() => onNavigate(alert.page)}
                  className="flex min-h-[60px] w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-emerald-50/40 active:scale-[0.99] sm:px-5 md:px-6"
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      alert.tone === "amber"
                        ? "bg-amber-50 text-amber-600"
                        : alert.tone === "sky"
                          ? "bg-sky-50 text-sky-600"
                          : "bg-emerald-50 text-emerald-600"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-800">
                      {alert.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">{alert.detail}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-300" />
                </button>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="p-4 sm:p-5 md:p-6">
        <h2 className="flex items-center gap-2 text-sm font-bold tracking-tight text-slate-900">
          <Zap className="h-4 w-4 text-emerald-600" /> Quick actions
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.target}
                type="button"
                onClick={() =>
                  onQuickAction({
                    target: action.target,
                    page: action.page,
                    nonce: Date.now(),
                  })
                }
                className="flex min-h-[96px] flex-col items-start justify-between rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/70 p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md active:scale-[0.98]"
              >
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-inset ring-black/[0.03] ${action.color}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="mt-3 flex items-center gap-1 text-sm font-bold text-slate-800">
                  {action.label} <Plus className="h-3 w-3 opacity-50" />
                </span>
                <span className="text-[11px] text-slate-400">{action.detail}</span>
              </button>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5 md:px-6">
            <h2 className="flex items-center gap-2 text-sm font-bold tracking-tight text-slate-900">
              <Egg className="h-4 w-4 text-emerald-600" /> Recent batches
            </h2>
            <button
              type="button"
              onClick={() => onNavigate("incubator")}
              className="min-h-11 rounded-lg px-2 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 active:scale-[0.98]"
            >
              View all
            </button>
          </div>
          {data.batches.length === 0 ? (
            <div className="p-3 sm:p-4">
              <EmptyState
                icon={Egg}
                title="No batches recorded yet"
                description="Start a batch from Quick actions to follow its incubation cycle."
              />
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.batches.slice(0, 4).map((batch) => {
                const progress = getBatchProgress(batch);
                return (
                  <div key={batch.id} className="flex min-h-[60px] items-center gap-3 px-4 py-3 sm:px-5 md:px-6">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">{batch.batch_name}</p>
                      <p className="text-xs text-slate-400">
                        {batch.total_eggs} eggs · {formatShortDate(batch.start_date)}
                      </p>
                    </div>
                    <Badge tone={batch.status === "completed" ? "slate" : progress.isLockdown ? "amber" : "green"}>
                      {batch.status === "completed"
                        ? `${batch.hatched_chicks ?? 0} hatched`
                        : `Day ${progress.currentDay}`}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5 md:px-6">
            <h2 className="flex items-center gap-2 text-sm font-bold tracking-tight text-slate-900">
              <Receipt className="h-4 w-4 text-emerald-600" /> Recent activity
            </h2>
            <button
              type="button"
              onClick={() => onNavigate("finance")}
              className="min-h-11 rounded-lg px-2 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 active:scale-[0.98]"
            >
              View all
            </button>
          </div>
          {data.transactions.length === 0 ? (
            <div className="p-3 sm:p-4">
              <EmptyState
                icon={Receipt}
                title="No transactions yet"
                description="Record income or expenses to see your farm activity here."
              />
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.transactions.slice(0, 4).map((transaction) => (
                <div key={transaction.id} className="flex min-h-[60px] items-center gap-3 px-4 py-3 sm:px-5 md:px-6">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{transaction.category}</p>
                    <p className="truncate text-xs text-slate-400">
                      {transaction.description || "—"} · {formatShortDate(transaction.transaction_date)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-bold tabular-nums ${
                      transaction.type === "income" ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    {transaction.type === "income" ? "+" : "−"}
                    {formatBDT(transaction.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
