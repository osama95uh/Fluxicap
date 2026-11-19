"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Bird,
  CheckCircle2,
  ChevronRight,
  Download,
  Egg,
  FileJson,
  FileSpreadsheet,
  Info,
  LayoutDashboard,
  Wallet,
  Wheat,
  X,
} from "lucide-react";
import { applyMutationLocal, persistMutation } from "@/lib/data";
import { downloadFarmBackup, type BackupFormat } from "@/lib/export";
import type { FarmData, FormRequest, Mutation, PageId } from "@/lib/types";
import { getBatchProgress } from "@/lib/utils";

import FeedInventory from "./FeedInventory";
import FlockManager from "./FlockManager";
import IncubatorTracker from "./IncubatorTracker";
import Overview from "./Overview";
import Transactions from "./Transactions";
import { Badge, Button, Modal } from "./ui";

type Notice = { tone: "success" | "error"; message: string };

const pages: { id: PageId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "incubator", label: "Incubator", icon: Egg },
  { id: "flocks", label: "Flocks", icon: Bird },
  { id: "feed", label: "Feed", icon: Wheat },
  { id: "finance", label: "Finance", icon: Wallet },
];

function mutationMessage(mutation: Mutation): string {
  switch (mutation.kind) {
    case "addBatch":
      return "Batch started";
    case "updateBatch":
      return "Batch counts updated";
    case "editBatch":
      return "Batch updated";
    case "deleteBatch":
      return "Batch deleted";
    case "completeAndMove":
      return "Chicks moved to a new flock";
    case "addFlock":
      return "Flock added";
    case "logMortality":
      return mutation.payload.mortality_count > 0 ? "Mortality logged" : "Care note saved";
    case "addFeedLog":
      return mutation.payload.action_type === "purchase"
        ? "Feed purchase logged"
        : "Feed consumption logged";
    case "editFeedLog":
      return "Feed log updated";
    case "deleteFeedLog":
      return "Feed log deleted";
    case "addTransaction":
      return `${mutation.payload.type === "income" ? "Income" : "Expense"} recorded`;
    case "editTransaction":
      return "Transaction updated";
    case "deleteTransaction":
      return "Transaction deleted";
    case "toggleBatchCheck":
      return "Incubator checklist updated";
    case "logEggCollection":
      return "Egg collection logged";
  }
}

export default function Dashboard({
  initialData,
  initialDemo,
  loadError,
}: {
  initialData: FarmData;
  initialDemo: boolean;
  loadError?: string;
}) {
  const [data, setData] = useState(initialData);
  const [demo] = useState(initialDemo);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [activePage, setActivePage] = useState<PageId>("overview");
  const [formRequest, setFormRequest] = useState<FormRequest>(null);
  const [showExport, setShowExport] = useState(false);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  async function handleMutation(mutation: Mutation) {
    setBusy(true);
    setNotice(null);
    try {
      const result = await persistMutation(mutation);
      if (!result.ok) {
        setNotice({ tone: "error", message: result.error ?? "Could not save the change." });
        return;
      }
      setData((current) => applyMutationLocal(current, mutation));
      setNotice({
        tone: "success",
        message: demo
          ? `${mutationMessage(mutation)} · demo only`
          : `${mutationMessage(mutation)} · saved`,
      });
    } finally {
      setBusy(false);
    }
  }

  function navigate(page: PageId) {
    setActivePage(page);
    if (page !== "overview") setFormRequest(null);
    window.scrollTo({ top: 0 });
  }

  function openForm(request: NonNullable<FormRequest>) {
    setActivePage(request.page);
    setFormRequest(request);
    window.scrollTo({ top: 0 });
  }

  const today = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());

  const criticalBatches = data.batches
    .filter((batch) => batch.status === "active")
    .map((batch) => ({ batch, progress: getBatchProgress(batch) }))
    .filter(({ progress }) => progress.isLockdown || progress.isHatching)
    .sort((a, b) => a.progress.daysRemaining - b.progress.daysRemaining);
  const critical = criticalBatches[0];

  function handleExport(format: BackupFormat) {
    downloadFarmBackup(data, format);
    setShowExport(false);
    setNotice({
      tone: "success",
      message: `${format.toUpperCase()} backup downloaded${demo ? " · demo data" : ""}`,
    });
  }

  return (
    <div className="min-h-screen overflow-x-hidden">
      <header className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-900 px-4 pb-7 pt-[calc(1.25rem+env(safe-area-inset-top))] text-white shadow-[0_10px_30px_-18px_rgba(4,120,87,0.9)] sm:px-6 sm:pb-9 sm:pt-8">
        <div
          className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-emerald-300/10 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-28 left-1/3 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-6xl">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 shadow-inner ring-1 ring-white/25">
                <Egg className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-extrabold leading-tight tracking-tight sm:text-2xl">Farm Manager</h1>
                <p className="truncate text-[11px] text-emerald-100 sm:text-sm">Poultry &amp; Incubator Monitor</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setShowExport(true)}
                aria-label="Export farm data"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white/15 px-3 text-xs font-bold text-white ring-1 ring-white/25 transition-all hover:bg-white/25 active:scale-[0.98]"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Export</span>
              </button>
              <div className="hidden text-right sm:block">
                <p className="text-xs text-emerald-100">{today}</p>
                <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold ring-1 ring-white/20 tabular-nums">
                  <span className={`h-2 w-2 rounded-full ${demo ? "bg-amber-300" : "bg-emerald-300"}`} />
                  {demo ? "DEMO" : "LIVE"}
                  {busy ? " · SAVING" : ""}
                </span>
              </div>
            </div>
          </div>
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold ring-1 ring-white/20 tabular-nums sm:hidden">
            <span className={`h-1.5 w-1.5 rounded-full ${demo ? "bg-amber-300" : "bg-emerald-300"}`} />
            {demo ? "DEMO" : "LIVE"}
            {busy ? " · SAVING" : ""}
          </span>
        </div>
      </header>

      <nav
        aria-label="Dashboard sections"
        className="sticky top-0 z-30 hidden border-b border-slate-200/80 bg-white/90 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur-xl md:block"
      >
        <div className="mx-auto flex max-w-6xl items-center gap-1 px-5 py-2.5">
          {pages.map((page) => {
            const Icon = page.icon;
            const isActive = activePage === page.id;
            return (
              <button
                key={page.id}
                type="button"
                aria-current={isActive ? "page" : undefined}
                onClick={() => navigate(page.id)}
                className={`inline-flex min-h-12 items-center gap-2 rounded-xl px-4 text-sm font-semibold tracking-tight transition-all active:scale-[0.98] ${
                  isActive
                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                }`}
              >
                <Icon className="h-4 w-4" />
                {page.label}
              </button>
            );
          })}
        </div>
      </nav>

      <main className="mx-auto w-full max-w-6xl space-y-5 overflow-x-hidden px-3 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-5 sm:px-5 sm:pt-7 md:pb-8 lg:space-y-6">
        {critical ? (
          <div className="animate-fade-in rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 via-orange-50/80 to-amber-50/60 p-4 shadow-sm ring-1 ring-amber-100 sm:p-5">
            <div className="flex flex-wrap items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-extrabold text-amber-900">
                    {critical.batch.batch_name} · {critical.progress.isHatching ? "Hatch day" : `Lockdown day ${critical.progress.currentDay}`}
                  </p>
                  <Badge tone={critical.progress.isHatching ? "green" : "amber"}>
                    {critical.progress.isHatching
                      ? "Ready to hatch"
                      : `${critical.progress.daysRemaining} days to hatch`}
                  </Badge>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-amber-800">
                  {critical.progress.isHatching
                    ? "Keep humidity steady. Open only after the hatch completes, then update counts and move the chicks."
                    : "Watch humidity and temperature. Stop or adjust turning and keep the incubator closed except for essential checks."}
                </p>
                {criticalBatches.length > 1 ? (
                  <p className="mt-1 text-[11px] font-semibold text-amber-700 tabular-nums">
                    +{criticalBatches.length - 1} more batch{criticalBatches.length > 2 ? "es" : ""} in lockdown or hatching
                  </p>
                ) : null}
              </div>
              <Button
                variant="secondary"
                onClick={() => navigate("incubator")}
                className="min-h-11 px-3 text-xs"
              >
                View batch <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}

        {demo ? (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              <strong>Demo mode.</strong> Showing sample data. Add your Supabase URL and key to{" "}
              <code className="mx-1 rounded bg-amber-100 px-1 py-0.5 text-xs">.env.local</code> and
              restart the server to save changes.
            </p>
          </div>
        ) : null}

        {loadError ? (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200/80 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              <strong>Could not load Supabase data:</strong> {loadError} — showing sample data
              instead.
            </p>
          </div>
        ) : null}

        <div key={activePage}>
          {activePage === "overview" ? (
            <div className="mx-auto w-full max-w-5xl space-y-5">
              <Overview data={data} onNavigate={navigate} onQuickAction={openForm} />
            </div>
          ) : null}
          {activePage === "incubator" ? (
            <div className="mx-auto w-full max-w-5xl space-y-5">
              <IncubatorTracker
                batches={data.batches}
                onMutate={handleMutation}
                formRequest={formRequest}
              />
            </div>
          ) : null}
          {activePage === "flocks" ? (
            <div className="mx-auto w-full max-w-5xl space-y-5">
              <FlockManager data={data} onMutate={handleMutation} formRequest={formRequest} />
            </div>
          ) : null}
          {activePage === "feed" ? (
            <div className="mx-auto w-full max-w-5xl space-y-5">
              <FeedInventory
                feedLogs={data.feedLogs}
                flocks={data.flocks}
                onMutate={handleMutation}
                formRequest={formRequest}
              />
            </div>
          ) : null}
          {activePage === "finance" ? (
            <div className="mx-auto w-full max-w-5xl space-y-5">
              <Transactions
                transactions={data.transactions}
                onMutate={handleMutation}
                formRequest={formRequest}
              />
            </div>
          ) : null}
        </div>

        <footer className="pb-2 pt-2 text-center text-xs text-slate-400">
          Poultry Farm Manager · Built with Next.js, Tailwind CSS &amp; Supabase
        </footer>
      </main>

      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_-14px_rgba(15,23,42,0.25)] backdrop-blur-xl md:hidden"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5 px-1 pt-1.5">
          {pages.map((page) => {
            const Icon = page.icon;
            const isActive = activePage === page.id;
            return (
              <button
                key={page.id}
                type="button"
                aria-current={isActive ? "page" : undefined}
                onClick={() => navigate(page.id)}
                className={`relative flex min-h-[3.5rem] flex-col items-center justify-center gap-1 px-1 text-[10px] font-semibold tracking-tight transition-all active:scale-[0.98] ${
                  isActive ? "text-emerald-700" : "text-slate-400"
                }`}
              >
                {isActive ? (
                  <span className="absolute top-0 h-0.5 w-7 rounded-full bg-emerald-600" aria-hidden="true" />
                ) : null}
                <span
                  className={`flex h-8 w-12 items-center justify-center rounded-xl transition-colors ${
                    isActive ? "bg-emerald-50 ring-1 ring-emerald-100" : ""
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="truncate">{page.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <Modal
        open={showExport}
        onClose={() => setShowExport(false)}
        title="Export farm data"
        description="Download a backup of all five tables, including saved checklist and egg logs."
      >
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => handleExport("json")}
            className="flex min-h-[72px] w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 text-left shadow-sm transition-all hover:border-emerald-300 hover:bg-emerald-50/50 hover:shadow-md active:scale-[0.98] sm:p-4"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <FileJson className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-slate-800">JSON backup</span>
              <span className="mt-0.5 block text-xs text-slate-500">Full structured export of every table.</span>
            </span>
            <Download className="h-4 w-4 shrink-0 text-slate-400" />
          </button>
          <button
            type="button"
            onClick={() => handleExport("csv")}
            className="flex min-h-[72px] w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 text-left shadow-sm transition-all hover:border-emerald-300 hover:bg-emerald-50/50 hover:shadow-md active:scale-[0.98] sm:p-4"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <FileSpreadsheet className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-slate-800">CSV backup</span>
              <span className="mt-0.5 block text-xs text-slate-500">Flat spreadsheet with one row per record.</span>
            </span>
            <Download className="h-4 w-4 shrink-0 text-slate-400" />
          </button>
        </div>
      </Modal>

      {notice ? (
        <div
          role="status"
          aria-live="polite"
          className="animate-toast-in fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 md:bottom-6"
        >
          <div
            className={`flex min-h-[52px] items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-white shadow-xl ring-1 ring-white/10 ${
              notice.tone === "success" ? "bg-emerald-700" : "bg-red-700"
            }`}
          >
            {notice.tone === "success" ? (
              <CheckCircle2 className="h-5 w-5 shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 shrink-0" />
            )}
            <span className="flex-1">{notice.message}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="Dismiss notification"
              className="min-h-11 min-w-11 rounded-lg p-2 transition-colors hover:bg-white/20 active:scale-95"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
