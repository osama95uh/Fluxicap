"use client";

import { AlertTriangle, Bird, Egg, Package, TrendingDown, TrendingUp, Wallet, Wheat } from "lucide-react";
import type { FarmData } from "@/lib/types";
import { LOW_FEED_THRESHOLD } from "@/lib/types";
import {
  formatBDT,
  getBatchProgress,
  getFeedStock,
  getLiveChickenCount,
  getMonthTotals,
} from "@/lib/utils";
import { Card } from "./ui";

function StatCard({
  icon: Icon,
  iconClass,
  label,
  value,
  valueClass = "text-slate-900",
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  label: string;
  value: string;
  valueClass?: string;
  children?: React.ReactNode;
}) {
  return (
    <Card className="flex min-h-[128px] flex-col p-3.5 sm:min-h-[148px] sm:p-5">
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-2xl shadow-sm ring-1 ring-inset ring-black/[0.03] ${iconClass}`}
      >
        <Icon className="h-[19px] w-[19px]" />
      </span>
      <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 sm:text-[11px]">
        {label}
      </p>
      <p
        className={`mt-1 truncate text-lg font-extrabold leading-tight tracking-tight tabular-nums sm:text-2xl xl:text-3xl ${valueClass}`}
      >
        {value}
      </p>
      <div className="mt-auto min-h-4 pt-1.5 text-[11px] leading-snug text-slate-500 sm:text-xs">
        {children}
      </div>
    </Card>
  );
}

export default function SummaryCards({ data }: { data: FarmData }) {
  const nextBatch = [...data.batches]
    .filter((batch) => batch.status === "active")
    .sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
  const progress = nextBatch ? getBatchProgress(nextBatch) : null;

  const liveCount = getLiveChickenCount(data.flocks);
  const activeFlockCount = data.flocks.filter((flock) => flock.status === "active").length;
  const feedStock = getFeedStock(data.feedLogs);
  const hasFeedLogs = data.feedLogs.length > 0;
  const lowFeed = hasFeedLogs && feedStock < LOW_FEED_THRESHOLD;
  const { income, expense, net } = getMonthTotals(data.transactions);

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        icon={Egg}
        iconClass="bg-gradient-to-br from-amber-50 to-amber-100/70 text-amber-600 ring-amber-100"
        label="Next hatch"
        value={progress ? (progress.isHatching ? "Hatching!" : `${progress.daysRemaining}d left`) : "—"}
        valueClass={progress?.isLockdown ? "text-amber-600" : "text-slate-900"}
      >
        {nextBatch ? (
          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span className="truncate font-medium text-slate-700">{nextBatch.batch_name}</span>
            <span className="text-slate-300">·</span>
            <span className="tabular-nums">
              Day {progress?.currentDay}/{progress?.spec.cycleDays}
            </span>
            {progress?.isLockdown ? (
              <span className="inline-flex items-center gap-1 font-semibold text-amber-600">
                <AlertTriangle className="h-3 w-3" /> Lockdown
              </span>
            ) : null}
          </span>
        ) : (
          "No active incubator batch"
        )}
      </StatCard>

      <StatCard
        icon={Bird}
        iconClass="bg-gradient-to-br from-emerald-50 to-teal-100/70 text-emerald-600 ring-emerald-100"
        label="Live chickens"
        value={liveCount.toLocaleString()}
      >
        Across {activeFlockCount} active {activeFlockCount === 1 ? "flock" : "flocks"}
      </StatCard>

      <StatCard
        icon={Wheat}
        iconClass={
          !hasFeedLogs
            ? "bg-slate-100 text-slate-500 ring-slate-200"
            : lowFeed
              ? "bg-gradient-to-br from-amber-50 to-amber-100/70 text-amber-600 ring-amber-100"
              : "bg-gradient-to-br from-lime-50 to-lime-100/70 text-lime-700 ring-lime-100"
        }
        label="Feed remaining"
        value={`${feedStock.toLocaleString()} kg`}
        valueClass={!hasFeedLogs ? "text-slate-500" : lowFeed ? "text-amber-600" : "text-slate-900"}
      >
        {!hasFeedLogs ? (
          <span className="inline-flex items-center gap-1 text-slate-500">
            <Package className="h-3.5 w-3.5 shrink-0" /> No feed logged yet
          </span>
        ) : lowFeed ? (
          <span className="inline-flex items-center gap-1 font-semibold text-amber-600">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Low stock — top up soon
          </span>
        ) : (
          `${LOW_FEED_THRESHOLD} kg warning threshold`
        )}
      </StatCard>

      <StatCard
        icon={Wallet}
        iconClass={
          net >= 0
            ? "bg-gradient-to-br from-emerald-50 to-teal-100/70 text-emerald-600 ring-emerald-100"
            : "bg-gradient-to-br from-red-50 to-rose-100/70 text-red-600 ring-red-100"
        }
        label="Net this month"
        value={formatBDT(net)}
        valueClass={net >= 0 ? "text-emerald-600" : "text-red-600"}
      >
        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
            <TrendingUp className="h-3.5 w-3.5 shrink-0" />
            <span className="tabular-nums">In {formatBDT(income)}</span>
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-red-500">
            <TrendingDown className="h-3.5 w-3.5 shrink-0" />
            <span className="tabular-nums">Out {formatBDT(expense)}</span>
          </span>
        </span>
      </StatCard>
    </div>
  );
}
