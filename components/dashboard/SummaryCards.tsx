"use client";

import { AlertTriangle, Bird, Egg, TrendingDown, TrendingUp, Wallet, Wheat } from "lucide-react";
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
    <Card className="flex min-h-[132px] flex-col p-3.5 sm:min-h-[148px] sm:p-5">
      <span className={`flex h-9 w-9 items-center justify-center rounded-xl shadow-sm sm:h-10 sm:w-10 sm:rounded-2xl ${iconClass}`}>
        <Icon className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
      </span>
      <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 sm:text-[11px]">
        {label}
      </p>
      <p className={`mt-1 truncate text-xl font-extrabold tracking-tight tabular-nums sm:text-2xl xl:text-3xl ${valueClass}`}>
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
  const lowFeed = feedStock < LOW_FEED_THRESHOLD;
  const { income, expense, net } = getMonthTotals(data.transactions);

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        icon={Egg}
        iconClass="bg-amber-50 text-amber-600 ring-1 ring-amber-100"
        label="Next hatch"
        value={progress ? (progress.isHatching ? "Hatching!" : `${progress.daysRemaining}d left`) : "—"}
        valueClass={progress?.isLockdown ? "text-amber-600" : "text-slate-900"}
      >
        {nextBatch ? (
          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span className="truncate font-medium text-slate-700">{nextBatch.batch_name}</span>
            <span className="text-slate-300">·</span>
            <span className="tabular-nums">Day {progress?.currentDay}/{progress?.spec.cycleDays}</span>
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
        iconClass="bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100"
        label="Live chickens"
        value={liveCount.toLocaleString()}
      >
        Across {activeFlockCount} active {activeFlockCount === 1 ? "flock" : "flocks"}
      </StatCard>

      <StatCard
        icon={Wheat}
        iconClass={lowFeed ? "bg-amber-50 text-amber-600 ring-1 ring-amber-100" : "bg-lime-50 text-lime-700 ring-1 ring-lime-100"}
        label="Feed remaining"
        value={`${feedStock.toLocaleString()} kg`}
        valueClass={lowFeed ? "text-amber-600" : "text-slate-900"}
      >
        {lowFeed ? (
          <span className="inline-flex items-center gap-1 font-semibold text-amber-600">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Low stock — top up soon
          </span>
        ) : (
          `${LOW_FEED_THRESHOLD} kg warning threshold`
        )}
      </StatCard>

      <StatCard
        icon={Wallet}
        iconClass={net >= 0 ? "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100" : "bg-red-50 text-red-600 ring-1 ring-red-100"}
        label="Net this month"
        value={formatBDT(net)}
        valueClass={net >= 0 ? "text-emerald-600" : "text-red-600"}
      >
        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="inline-flex items-center gap-1 text-emerald-600">
            <TrendingUp className="h-3.5 w-3.5 shrink-0" /> {formatBDT(income)}
          </span>
          <span className="inline-flex items-center gap-1 text-red-500">
            <TrendingDown className="h-3.5 w-3.5 shrink-0" /> {formatBDT(expense)}
          </span>
        </span>
      </StatCard>
    </div>
  );
}
