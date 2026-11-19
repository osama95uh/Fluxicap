import { readMeta } from "./farm-meta";
import {
  INCUBATOR_CYCLES,
  type BatchChecklist,
  type EggCollection,
  type FarmTransaction,
  type FeedLog,
  type FlockLog,
  type IncubatorBatch,
  type PoultryFlock,
} from "./types";

export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateOnly(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

function dayIndex(date: Date): number {
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000,
  );
}

export function calendarDaysBetween(start: Date, end: Date): number {
  return dayIndex(end) - dayIndex(start);
}

export function ageInDays(startDate: string, today = new Date()): number {
  return Math.max(0, calendarDaysBetween(parseDateOnly(startDate), today));
}

export function getBatchProgress(batch: IncubatorBatch, today = new Date()) {
  const spec = INCUBATOR_CYCLES[batch.egg_type] ?? INCUBATOR_CYCLES.chicken;
  const elapsed = ageInDays(batch.start_date, today);
  const currentDay = Math.min(spec.cycleDays, elapsed + 1);
  const daysRemaining = Math.max(0, spec.cycleDays - elapsed);
  const isHatching = elapsed >= spec.cycleDays;
  const isLockdown = !isHatching && currentDay >= spec.lockdownDay;
  const progress = Math.min(100, Math.round((elapsed / spec.cycleDays) * 100));

  return { spec, elapsed, currentDay, daysRemaining, isHatching, isLockdown, progress };
}

export function formatBDT(amount: number): string {
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Math.abs(amount));
  return amount < 0 ? `৳ -${formatted}` : `৳ ${formatted}`;
}

export function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(parseDateOnly(value));
}

export function getFeedStock(logs: FeedLog[]): number {
  return logs.reduce((total, log) => {
    const quantity = Number(log.quantity_kg) || 0;
    return total + (log.action_type === "purchase" ? quantity : -quantity);
  }, 0);
}

export function getLiveChickenCount(flocks: PoultryFlock[]): number {
  return flocks
    .filter((flock) => flock.status === "active")
    .reduce((total, flock) => total + Number(flock.current_count || 0), 0);
}

export function getMonthTotals(transactions: FarmTransaction[], today = new Date()) {
  let income = 0;
  let expense = 0;

  for (const transaction of transactions) {
    const date = parseDateOnly(transaction.transaction_date);
    if (date.getFullYear() !== today.getFullYear() || date.getMonth() !== today.getMonth()) {
      continue;
    }
    const amount = Number(transaction.amount) || 0;
    if (transaction.type === "income") income += amount;
    else expense += amount;
  }

  return { income, expense, net: income - expense };
}

export function getBatchChecklist(batch: IncubatorBatch): BatchChecklist {
  return readMeta<BatchChecklist>(batch.notes, "checks") ?? {};
}

export function getEggCollection(log: FlockLog): EggCollection | null {
  return readMeta<EggCollection>(log.notes, "eggs");
}

export function isEggLog(log: FlockLog): boolean {
  return getEggCollection(log) !== null;
}

export function getLiveFlockCount(flocks: PoultryFlock[]): number {
  return getLiveChickenCount(flocks);
}

export function getHatchStats(batches: IncubatorBatch[]) {
  const rows = batches
    .filter((batch) => batch.status === "completed" && batch.hatched_chicks !== null)
    .map((batch) => {
      const denominator = Number(batch.fertile_eggs ?? batch.total_eggs) || 0;
      const hatched = Number(batch.hatched_chicks) || 0;
      return {
        id: batch.id,
        name: batch.batch_name,
        startDate: batch.start_date,
        hatched,
        denominator,
        rate: denominator > 0 ? Math.min(100, Math.round((hatched / denominator) * 100)) : 0,
      };
    })
    .filter((row) => row.denominator > 0)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));

  const average = rows.length
    ? Math.round(rows.reduce((sum, row) => sum + row.rate, 0) / rows.length)
    : 0;
  return { rows, average };
}

const FEED_ESTIMATE_DAYS = 30;

export function getFeedEstimate(
  logs: FeedLog[],
  flockCount: number,
  today = new Date(),
) {
  const todayISO = toISODate(today);
  const cutoff = daysAgo(FEED_ESTIMATE_DAYS - 1, today);
  const recent = logs.filter(
    (log) =>
      log.action_type === "consume" &&
      log.log_date >= cutoff &&
      log.log_date <= todayISO,
  );
  const totalKg = recent.reduce((sum, log) => sum + (Number(log.quantity_kg) || 0), 0);
  const firstDate = recent.reduce(
    (earliest, log) => (!earliest || log.log_date < earliest ? log.log_date : earliest),
    "",
  );
  const spanDays = firstDate
    ? Math.max(1, calendarDaysBetween(parseDateOnly(firstDate), today) + 1)
    : 0;
  const dailyKg = spanDays > 0 ? totalKg / spanDays : 0;
  const stock = getFeedStock(logs);

  return {
    hasConsumption: recent.length > 0,
    dailyKg,
    perBirdGrams: flockCount > 0 ? (dailyKg * 1000) / flockCount : null,
    daysLeft: dailyKg > 0 ? Math.floor(stock / dailyKg) : null,
    stock,
    windowDays: FEED_ESTIMATE_DAYS,
  };
}

export function getExpenseBreakdown(transactions: FarmTransaction[], today = new Date()) {
  const byCategory = new Map<string, number>();
  let total = 0;

  for (const transaction of transactions) {
    if (transaction.type !== "expense") continue;
    const date = parseDateOnly(transaction.transaction_date);
    if (date.getFullYear() !== today.getFullYear() || date.getMonth() !== today.getMonth()) {
      continue;
    }
    const amount = Number(transaction.amount) || 0;
    byCategory.set(transaction.category, (byCategory.get(transaction.category) ?? 0) + amount);
    total += amount;
  }

  return {
    total,
    rows: [...byCategory.entries()]
      .map(([category, amount]) => ({
        category,
        amount,
        percent: total > 0 ? Math.round((amount / total) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount),
  };
}

export function monthDate(daysAgo: number, today = new Date()): string {
  return toISODate(
    new Date(today.getFullYear(), today.getMonth(), Math.max(1, today.getDate() - daysAgo)),
  );
}

export function daysAgo(days: number, today = new Date()): string {
  const date = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  date.setDate(date.getDate() - days);
  return toISODate(date);
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
