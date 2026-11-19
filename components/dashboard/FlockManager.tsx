"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Bird,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Egg,
  ListChecks,
  Pencil,
  Plus,
  Syringe,
} from "lucide-react";
import { stripMeta } from "@/lib/farm-meta";
import type {
  FarmData,
  FlockLog,
  FormRequest,
  Mutation,
  PoultryFlock,
} from "@/lib/types";
import {
  ageInDays,
  calendarDaysBetween,
  formatShortDate,
  getEggCollection,
  isEggLog,
  parseDateOnly,
  toISODate,
} from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  SectionHeader,
  Textarea,
} from "./ui";

type LogMode = "mortality" | "care";

type LogForm = {
  flockId: string;
  mode: LogMode;
  count: string;
  vaccine: string;
  notes: string;
  date: string;
};

type EggForm = {
  flockId: string;
  logId?: string;
  date: string;
  collected: string;
  spoiled: string;
  sold: string;
};

const VACCINE_GUIDE = [
  {
    id: "electrolytes",
    day: 1,
    name: "Electrolytes / vitamins",
    note: "Offer in drinking water after arrival or transport stress.",
  },
  {
    id: "gumboro-1",
    day: 8,
    name: "Gumboro vaccine",
    note: "First dose; follow the vaccine label for preparation.",
  },
  {
    id: "ranikhet-1",
    day: 14,
    name: "Ranikhet (ND) vaccine",
    note: "Newcastle disease vaccination; avoid mixing with other treatments.",
  },
  {
    id: "gumboro-2",
    day: 21,
    name: "Gumboro booster",
    note: "Booster dose as birds mature.",
  },
  {
    id: "ranikhet-2",
    day: 28,
    name: "Ranikhet booster",
    note: "Follow-up Newcastle disease dose and flock observation.",
  },
] as const;

function relativeDay(value: string): string {
  const diff = calendarDaysBetween(new Date(), parseDateOnly(value));
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff > 1) return `In ${diff} days`;
  if (diff === -1) return "Yesterday";
  return `${Math.abs(diff)} days ago`;
}

function guideDate(startDate: string, day: number): string {
  const date = parseDateOnly(startDate);
  date.setDate(date.getDate() + day);
  return toISODate(date);
}

export default function FlockManager({
  data,
  onMutate,
  formRequest,
}: {
  data: FarmData;
  onMutate: (mutation: Mutation) => Promise<void>;
  formRequest?: FormRequest;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [initialCount, setInitialCount] = useState("100");
  const [startDate, setStartDate] = useState(toISODate(new Date()));
  const [addError, setAddError] = useState("");

  const [logForm, setLogForm] = useState<LogForm | null>(null);
  const [logError, setLogError] = useState("");

  const [eggForm, setEggForm] = useState<EggForm | null>(null);
  const [eggError, setEggError] = useState("");

  useEffect(() => {
    if (formRequest?.target === "flock") {
      setAddError("");
      setShowAdd(true);
    }
  }, [formRequest?.nonce]);

  const active = data.flocks.filter((flock) => flock.status === "active" && flock.current_count > 0);
  const soldOut = data.flocks.filter((flock) => flock.status === "sold_out" || flock.current_count <= 0);
  const todayISO = toISODate(new Date());

  const nonEggLogs = data.flockLogs.filter((log) => !isEggLog(log));
  const recentLogs = nonEggLogs.slice(0, 5);
  const careLogs = nonEggLogs
    .filter((log) => Boolean(log.vaccine_or_medicine?.trim()))
    .sort((a, b) => a.log_date.localeCompare(b.log_date));
  const upcomingCare = careLogs.filter((log) => log.log_date > todayISO);
  const pastCare = careLogs.filter((log) => log.log_date <= todayISO).reverse();
  const eggLogs = data.flockLogs.filter((log) => isEggLog(log)).slice(0, 6);

  const logFlock = logForm ? data.flocks.find((flock) => flock.id === logForm.flockId) : undefined;
  const eggFlock = eggForm ? data.flocks.find((flock) => flock.id === eggForm.flockId) : undefined;

  function resetAddForm() {
    setName("");
    setInitialCount("100");
    setStartDate(toISODate(new Date()));
    setAddError("");
  }

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAddError("");
    const count = Number(initialCount);

    if (!name.trim()) return setAddError("Enter a flock name.");
    if (!Number.isInteger(count) || count < 1) return setAddError("Initial count must be at least 1.");
    if (!startDate) return setAddError("Choose a start date.");

    await onMutate({
      kind: "addFlock",
      payload: { flock_name: name.trim(), initial_count: count, start_date: startDate },
    });
    resetAddForm();
    setShowAdd(false);
  }

  function openLog(flock: PoultryFlock, mode: LogMode = "mortality") {
    setLogError("");
    setLogForm({
      flockId: flock.id,
      mode,
      count: mode === "care" ? "0" : "1",
      vaccine: "",
      notes: "",
      date: todayISO,
    });
  }

  async function handleLog() {
    if (!logForm || !logFlock) return;
    setLogError("");

    const isCare = logForm.mode === "care";
    const count = isCare ? 0 : Number(logForm.count);
    if (!isCare && (!Number.isInteger(count) || count < 0)) {
      return setLogError("Mortality must be 0 or more.");
    }
    if (count > logFlock.current_count) return setLogError("Mortality cannot exceed the current count.");
    if (isCare && !logForm.vaccine.trim()) return setLogError("Enter the vaccine or medicine given.");
    if (!logForm.date) return setLogError("Choose a log date.");

    const newCount = logFlock.current_count - count;
    await onMutate({
      kind: "logMortality",
      flockId: logFlock.id,
      newCount,
      newStatus: newCount === 0 ? "sold_out" : undefined,
      payload: {
        log_date: logForm.date,
        mortality_count: count,
        vaccine_or_medicine: logForm.vaccine.trim() || null,
        notes: logForm.notes.trim() || null,
      },
    });
    setLogForm(null);
  }

  async function markGuideDone(flock: PoultryFlock, item: (typeof VACCINE_GUIDE)[number]) {
    await onMutate({
      kind: "logMortality",
      flockId: flock.id,
      newCount: flock.current_count,
      payload: {
        log_date: todayISO,
        mortality_count: 0,
        vaccine_or_medicine: item.name,
        notes: `Age-day guide (day ${item.day}) · ${item.note}`,
      },
    });
  }

  function existingEggLog(flockId: string, date: string): FlockLog | undefined {
    return data.flockLogs.find((log) => log.flock_id === flockId && log.log_date === date && isEggLog(log));
  }

  function openEggLog(flock: PoultryFlock) {
    setEggError("");
    const existing = existingEggLog(flock.id, todayISO);
    const collection = existing ? getEggCollection(existing) : null;
    setEggForm({
      flockId: flock.id,
      logId: existing?.id,
      date: existing?.log_date ?? todayISO,
      collected: collection ? String(collection.collected) : "",
      spoiled: collection ? String(collection.spoiled) : "0",
      sold: collection ? String(collection.sold) : "",
    });
  }

  async function handleEggLog() {
    if (!eggForm || !eggFlock) return;
    setEggError("");

    const collected = Number(eggForm.collected);
    const spoiled = Number(eggForm.spoiled || 0);
    const sold = Number(eggForm.sold || 0);

    if (!Number.isInteger(collected) || collected < 0) return setEggError("Enter collected eggs as 0 or more.");
    if (!Number.isInteger(spoiled) || spoiled < 0) return setEggError("Broken / spoiled eggs cannot be negative.");
    if (!Number.isInteger(sold) || sold < 0) return setEggError("Sold eggs cannot be negative.");
    if (spoiled > collected) return setEggError("Broken / spoiled eggs cannot exceed collected eggs.");
    if (sold > collected - spoiled) return setEggError("Sold eggs cannot exceed good eggs.");
    if (!eggForm.date) return setEggError("Choose a log date.");

    const existing = eggForm.logId ? data.flockLogs.find((log) => log.id === eggForm.logId) : undefined;
    await onMutate({
      kind: "logEggCollection",
      flockId: eggForm.flockId,
      logId: existing?.id,
      log_date: eggForm.date,
      collected,
      spoiled,
      sold,
      notes: existing?.notes ?? null,
    });
    setEggForm(null);
  }

  function careRow(log: FlockLog, upcoming: boolean) {
    const flock = data.flocks.find((item) => item.id === log.flock_id);
    return (
      <div
        key={log.id}
        className={`rounded-xl px-3 py-2.5 ring-1 ${upcoming ? "bg-sky-50 ring-sky-100" : "bg-slate-50 ring-slate-100"}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-800">{flock?.flock_name ?? "Unknown flock"}</p>
          <Badge tone={upcoming ? "blue" : "slate"}>
            <Clock className="h-3 w-3" /> {relativeDay(log.log_date)}
          </Badge>
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-sky-800">
          <Syringe className="h-3.5 w-3.5 shrink-0" /> {log.vaccine_or_medicine}
        </p>
        <p className="mt-0.5 text-[11px] text-slate-400 tabular-nums">
          {formatShortDate(log.log_date)}
          {stripMeta(log.notes) ? ` · ${stripMeta(log.notes)}` : ""}
        </p>
      </div>
    );
  }

  return (
    <>
      <Card>
        <SectionHeader
          icon={Bird}
          title="Flock & Mortality"
          subtitle="Bird counts, losses, vaccines and medicine"
          action={
            <Button onClick={() => { resetAddForm(); setShowAdd(true); }} className="px-3 sm:px-4">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add flock</span>
            </Button>
          }
        />

        <div className="space-y-3 p-4 sm:p-5 md:p-6">
          {active.length === 0 ? (
            <EmptyState icon={Bird} title="No active flocks" description="Add a flock to start tracking bird counts and losses." />
          ) : null}

          {active.map((flock) => {
            const survival = flock.initial_count > 0
              ? Math.round((flock.current_count / flock.initial_count) * 100)
              : 0;

            return (
              <div key={flock.id} className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 shadow-sm sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-slate-900">{flock.flock_name}</h3>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 tabular-nums">
                      <CalendarDays className="h-3.5 w-3.5" />
                      Day {ageInDays(flock.start_date)} old · started {formatShortDate(flock.start_date)}
                    </p>
                  </div>
                  <div className="text-right tabular-nums">
                    <p className="text-lg font-extrabold leading-tight text-emerald-700">
                      {flock.current_count.toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-500">of {flock.initial_count.toLocaleString()} birds</p>
                  </div>
                </div>

                <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white shadow-inner">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${survival}%` }} />
                </div>
                <p className="mt-1.5 text-[11px] text-slate-400 tabular-nums">{survival}% survival rate</p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => openEggLog(flock)} className="min-w-0 flex-1 px-2 sm:flex-none sm:px-4">
                    <Egg className="h-4 w-4 shrink-0" /> Log eggs
                  </Button>
                  <Button variant="secondary" onClick={() => openLog(flock, "mortality")} className="min-w-0 flex-1 px-2 sm:flex-none sm:px-4">
                    <AlertTriangle className="h-4 w-4 shrink-0" /> Mortality
                  </Button>
                  <Button variant="secondary" onClick={() => openLog(flock, "care")} className="min-w-0 flex-1 px-2 sm:flex-none sm:px-4">
                    <Syringe className="h-4 w-4 shrink-0" /> Care
                  </Button>
                </div>
              </div>
            );
          })}

          <div className="border-t border-slate-100 pt-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">
              <Syringe className="h-3.5 w-3.5 shrink-0" />
              <span>Care schedule</span>
            </p>
            <div className="space-y-3">
              <div>
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-sky-700">
                  Upcoming care
                </p>
                {upcomingCare.length === 0 ? (
                  <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-400">
                    Nothing scheduled. Use a future date when logging care.
                  </p>
                ) : (
                  <div className="space-y-2">{upcomingCare.map((log) => careRow(log, true))}</div>
                )}
              </div>
              <div>
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  Care history
                </p>
                {pastCare.length === 0 ? (
                  <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-400">
                    No past care notes yet.
                  </p>
                ) : (
                  <div className="space-y-2">{pastCare.map((log) => careRow(log, false))}</div>
                )}
              </div>
            </div>
          </div>

          {recentLogs.length > 0 ? (
            <div className="border-t border-slate-100 pt-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Recent flock logs</p>
              <div className="space-y-2">
                {recentLogs.map((log) => {
                  const flock = data.flocks.find((item) => item.id === log.flock_id);
                  const notes = stripMeta(log.notes);
                  return (
                    <div key={log.id} className="rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-100">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-700">
                          {flock?.flock_name ?? "Unknown flock"}
                        </p>
                        <div className="flex items-center gap-2 tabular-nums">
                          {log.mortality_count > 0 ? (
                            <Badge tone="red">−{log.mortality_count} birds</Badge>
                          ) : null}
                          <span className="text-xs text-slate-400">{formatShortDate(log.log_date)}</span>
                        </div>
                      </div>
                      {log.vaccine_or_medicine ? (
                        <p className="mt-1 flex items-center gap-1 text-xs text-sky-700">
                          <Syringe className="h-3.5 w-3.5" /> {log.vaccine_or_medicine}
                        </p>
                      ) : null}
                      {notes ? <p className="mt-1 text-xs text-slate-500">{notes}</p> : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {soldOut.length > 0 ? (
            <div className="border-t border-slate-100 pt-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Sold out / closed</p>
              <div className="flex flex-wrap gap-2">
                {soldOut.map((flock) => (
                  <Badge key={flock.id} tone="slate">{flock.flock_name}</Badge>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </Card>

      <Card>
        <SectionHeader
          icon={ListChecks}
          title="Vaccine & medicine guide"
          subtitle="Typical age-based schedule with notes for each flock"
        />
        {active.length === 0 ? (
          <EmptyState icon={Syringe} title="No active flocks" description="Add a flock to see its age-based care schedule." />
        ) : (
          <div className="space-y-4 p-4 sm:p-5 md:p-6">
            {active.map((flock) => {
              const age = ageInDays(flock.start_date);
              return (
                <div key={flock.id} className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3.5 shadow-sm sm:p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-bold text-slate-800">{flock.flock_name}</p>
                    <Badge tone={age >= 28 ? "slate" : "green"}>Day {age} old</Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {VACCINE_GUIDE.map((item) => {
                      const dueDate = guideDate(flock.start_date, item.day);
                      const done = data.flockLogs.some(
                        (log) =>
                          log.flock_id === flock.id &&
                          log.log_date >= dueDate &&
                          log.vaccine_or_medicine?.trim().toLowerCase() === item.name.toLowerCase(),
                      );
                      const overdue = !done && age > item.day + 2;
                      const dueSoon = !done && !overdue && age >= item.day - 1;

                      return (
                        <div
                          key={`${flock.id}-${item.id}`}
                          className={`rounded-xl p-3 ring-1 ${done ? "bg-emerald-50 ring-emerald-100" : overdue ? "bg-amber-50 ring-amber-200" : "bg-white ring-slate-200"}`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800">{item.name}</p>
                              <p className="mt-0.5 text-[11px] text-slate-400 tabular-nums">
                                Day {item.day} · {formatShortDate(dueDate)}
                              </p>
                            </div>
                            <Badge tone={done ? "green" : overdue ? "amber" : dueSoon ? "blue" : "slate"}>
                              {done ? <CheckCircle2 className="h-3 w-3" /> : overdue ? <Clock className="h-3 w-3" /> : null}
                              {done ? "Done" : overdue ? "Overdue" : dueSoon ? "Due" : `Day ${item.day}`}
                            </Badge>
                          </div>
                          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">{item.note}</p>
                          {!done ? (
                            <button
                              type="button"
                              onClick={() => void markGuideDone(flock, item)}
                              className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-white px-3 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200 transition-all hover:bg-emerald-50 active:scale-[0.98]"
                            >
                              <Check className="h-3.5 w-3.5" /> Mark done
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card>
        <SectionHeader
          icon={Egg}
          title="Daily egg collection"
          subtitle="Collected, broken / spoiled and sold eggs per flock"
        />
        {eggLogs.length === 0 ? (
          <EmptyState icon={Egg} title="No egg logs yet" description="Use Log eggs on a flock to record daily collection." />
        ) : (
          <div className="space-y-2 p-4 sm:p-5 md:p-6">
            {eggLogs.map((log) => {
              const flock = data.flocks.find((item) => item.id === log.flock_id);
              const collection = getEggCollection(log);
              if (!collection) return null;
              return (
                <div key={log.id} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-800">{flock?.flock_name ?? "Unknown flock"}</p>
                      <p className="text-[11px] text-slate-400 tabular-nums">{formatShortDate(log.log_date)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 tabular-nums">
                      <Badge tone="green">{collection.collected} collected</Badge>
                      <Badge tone="amber">{collection.spoiled} spoiled</Badge>
                      <Badge tone="blue">{collection.sold} sold</Badge>
                      <IconButton
                        label="Edit egg log"
                        onClick={() => {
                          setEggError("");
                          setEggForm({
                            flockId: log.flock_id,
                            logId: log.id,
                            date: log.log_date,
                            collected: String(collection.collected),
                            spoiled: String(collection.spoiled),
                            sold: String(collection.sold),
                          });
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </IconButton>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="Add a flock"
        description="Record a new group of birds and their start date."
      >
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Flock name">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Layer Flock 3" required />
            </Field>
            <Field label="Initial birds">
              <Input type="number" min={1} value={initialCount} onChange={(e) => setInitialCount(e.target.value)} required />
            </Field>
            <Field label="Start date">
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </Field>
          </div>
          {addError ? <p className="text-sm font-medium text-red-600">{addError}</p> : null}
          <div className="flex gap-2">
            <Button type="submit" className="flex-1">Add flock</Button>
            <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(logForm && logFlock)}
        onClose={() => setLogForm(null)}
        title={logForm?.mode === "care" ? "Log care / vaccine" : "Log mortality"}
        description={logFlock ? `${logFlock.flock_name} · ${logFlock.current_count.toLocaleString()} birds` : undefined}
      >
        {logForm && logFlock ? (
          <form
            onSubmit={(event) => { event.preventDefault(); void handleLog(); }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
              {(["mortality", "care"] as LogMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() =>
                    setLogForm({
                      ...logForm,
                      mode,
                      count: mode === "care" ? "0" : logForm.count === "0" ? "1" : logForm.count,
                    })
                  }
                  className={`min-h-11 rounded-lg text-sm font-bold capitalize transition-all active:scale-[0.98] ${
                    logForm.mode === mode
                      ? "bg-white text-emerald-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {mode === "mortality" ? "Mortality" : "Care / vaccine"}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {logForm.mode === "mortality" ? (
                <Field label="Mortality count">
                  <Input
                    type="number"
                    min={0}
                    max={logFlock.current_count}
                    value={logForm.count}
                    onChange={(e) => setLogForm({ ...logForm, count: e.target.value })}
                  />
                </Field>
              ) : null}
              <Field
                label={logForm.mode === "care" ? "Care date" : "Log date"}
                hint={logForm.mode === "care" ? "Future dates appear under Upcoming care." : undefined}
              >
                <Input type="date" value={logForm.date} onChange={(e) => setLogForm({ ...logForm, date: e.target.value })} />
              </Field>
            </div>

            <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                {logForm.mode === "care" ? "Care details" : "Optional treatment details"}
              </p>
              <Field label={logForm.mode === "care" ? "Vaccine / medicine" : "Vaccine / medicine (optional)"}>
                <Input
                  value={logForm.vaccine}
                  onChange={(e) => setLogForm({ ...logForm, vaccine: e.target.value })}
                  placeholder="e.g. Newcastle vaccine"
                />
              </Field>
              <Field label="Notes (optional)">
                <Textarea
                  value={logForm.notes}
                  onChange={(e) => setLogForm({ ...logForm, notes: e.target.value })}
                  placeholder="Reason, observations…"
                />
              </Field>
            </div>

            {logForm.mode === "care" ? (
              <p className="flex items-center gap-1.5 text-xs text-sky-700">
                <Syringe className="h-3.5 w-3.5" />
                Care notes do not change the bird count. Use a future date to schedule.
              </p>
            ) : (
              <p className="flex items-center gap-1.5 text-xs text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5" />
                Saving will reduce this flock to {Math.max(0, logFlock.current_count - (Number(logForm.count) || 0))} birds.
              </p>
            )}
            {logError ? <p className="text-sm font-medium text-red-600">{logError}</p> : null}
            <div className="flex gap-2">
              <Button type="submit" className="flex-1"><Check className="h-4 w-4" /> Save log</Button>
              <Button variant="secondary" onClick={() => setLogForm(null)}>Cancel</Button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(eggForm && eggFlock)}
        onClose={() => setEggForm(null)}
        title="Log daily eggs"
        description={eggFlock ? `${eggFlock.flock_name} · one record per flock per date` : undefined}
      >
        {eggForm && eggFlock ? (
          <form
            onSubmit={(event) => { event.preventDefault(); void handleEggLog(); }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Date">
                <Input type="date" value={eggForm.date} onChange={(e) => setEggForm({ ...eggForm, date: e.target.value })} required />
              </Field>
              <Field label="Collected eggs">
                <Input type="number" min={0} value={eggForm.collected} onChange={(e) => setEggForm({ ...eggForm, collected: e.target.value })} placeholder="0" required />
              </Field>
              <Field label="Broken / spoiled eggs">
                <Input type="number" min={0} value={eggForm.spoiled} onChange={(e) => setEggForm({ ...eggForm, spoiled: e.target.value })} />
              </Field>
              <Field label="Sold eggs" hint="Cannot exceed good eggs.">
                <Input type="number" min={0} value={eggForm.sold} onChange={(e) => setEggForm({ ...eggForm, sold: e.target.value })} />
              </Field>
            </div>
            {eggError ? <p className="text-sm font-medium text-red-600">{eggError}</p> : null}
            <div className="flex gap-2">
              <Button type="submit" className="flex-1"><Egg className="h-4 w-4" /> Save egg log</Button>
              <Button variant="secondary" onClick={() => setEggForm(null)}>Cancel</Button>
            </div>
          </form>
        ) : null}
      </Modal>
    </>
  );
}
