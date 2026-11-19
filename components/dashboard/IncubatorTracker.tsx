"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Bird,
  CalendarDays,
  Check,
  CheckCircle2,
  Egg,
  ListChecks,
  Pencil,
  Plus,
} from "lucide-react";
import { stripMeta } from "@/lib/farm-meta";
import {
  EGG_CAPACITY,
  INCUBATOR_CYCLES,
  type EggType,
  type FormRequest,
  type IncubatorBatch,
  type Mutation,
} from "@/lib/types";
import {
  formatShortDate,
  getBatchChecklist,
  getBatchProgress,
  getHatchStats,
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
  Textarea,
} from "./ui";

type BatchFields = {
  name: string;
  eggType: EggType;
  totalEggs: string;
  startDate: string;
  notes: string;
};

type UpdateForm = { id: string; fertile: string; hatched: string; complete: boolean };

function candlingReminder(currentDay: number, lockdownDay: number): number | null {
  return [7, 14].find((day) => day < lockdownDay && Math.abs(currentDay - day) <= 1) ?? null;
}

export default function IncubatorTracker({
  batches,
  onMutate,
  formRequest,
}: {
  batches: IncubatorBatch[];
  onMutate: (mutation: Mutation) => Promise<void>;
  formRequest?: FormRequest;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [eggType, setEggType] = useState<EggType>("chicken");
  const [totalEggs, setTotalEggs] = useState("188");
  const [startDate, setStartDate] = useState(toISODate(new Date()));
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const [update, setUpdate] = useState<UpdateForm | null>(null);
  const [updateError, setUpdateError] = useState("");

  const [edit, setEdit] = useState<(BatchFields & { id: string }) | null>(null);
  const [editError, setEditError] = useState("");

  useEffect(() => {
    if (!formRequest) return;
    if (formRequest.target === "batch") {
      setError("");
      setShowAdd(true);
    } else if (formRequest.target === "batchUpdate" && formRequest.id) {
      const batch = batches.find((item) => item.id === formRequest.id);
      if (batch) openUpdate(batch);
    }
    // Respond only to new requests, not data refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formRequest?.nonce]);

  const active = batches.filter((batch) => batch.status === "active");
  const completed = batches.filter((batch) => batch.status === "completed");
  const hatchStats = getHatchStats(batches);
  const cycle = INCUBATOR_CYCLES[eggType];

  const usedEggs = active.reduce((total, batch) => total + Number(batch.total_eggs || 0), 0);
  const freeEggs = Math.max(0, EGG_CAPACITY - usedEggs);
  const usedPercent = Math.min(100, Math.round((usedEggs / EGG_CAPACITY) * 100));
  const nearFull = freeEggs <= 20;

  const updateBatch = update ? batches.find((batch) => batch.id === update.id) : undefined;

  function resetAddForm() {
    setName("");
    setEggType("chicken");
    setTotalEggs("188");
    setStartDate(toISODate(new Date()));
    setNotes("");
    setError("");
  }

  function validateBatchFields(fields: BatchFields): string | null {
    const total = Number(fields.totalEggs);
    if (!fields.name.trim()) return "Enter a batch name.";
    if (!Number.isInteger(total) || total < 1 || total > EGG_CAPACITY) {
      return `Total eggs must be between 1 and ${EGG_CAPACITY}.`;
    }
    if (!fields.startDate) return "Choose a start date.";
    return null;
  }

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateBatchFields({ name, eggType, totalEggs, startDate, notes });
    if (validation) return setError(validation);
    setError("");

    await onMutate({
      kind: "addBatch",
      payload: {
        batch_name: name.trim(),
        egg_type: eggType,
        total_eggs: Number(totalEggs),
        start_date: startDate,
        notes: notes.trim() || null,
      },
    });
    resetAddForm();
    setShowAdd(false);
  }

  function openUpdate(batch: IncubatorBatch) {
    setUpdateError("");
    setUpdate({
      id: batch.id,
      fertile: batch.fertile_eggs?.toString() ?? "",
      hatched: batch.hatched_chicks?.toString() ?? "",
      complete: batch.status === "completed",
    });
  }

  async function handleUpdate() {
    if (!update || !updateBatch) return;
    setUpdateError("");

    const fertile = update.fertile === "" ? null : Number(update.fertile);
    const hatched = update.hatched === "" ? null : Number(update.hatched);

    if (fertile !== null && (!Number.isInteger(fertile) || fertile < 0 || fertile > updateBatch.total_eggs)) {
      return setUpdateError(`Fertile eggs must be 0–${updateBatch.total_eggs}.`);
    }
    if (hatched !== null && (!Number.isInteger(hatched) || hatched < 0 || hatched > updateBatch.total_eggs)) {
      return setUpdateError(`Hatched chicks must be 0–${updateBatch.total_eggs}.`);
    }

    await onMutate({
      kind: "updateBatch",
      id: update.id,
      payload: {
        fertile_eggs: fertile,
        hatched_chicks: hatched,
        status: update.complete ? "completed" : "active",
      },
    });
    setUpdate(null);
  }

  function openEdit(batch: IncubatorBatch) {
    setEditError("");
    setEdit({
      id: batch.id,
      name: batch.batch_name,
      eggType: batch.egg_type,
      totalEggs: String(batch.total_eggs),
      startDate: batch.start_date,
      notes: batch.notes ?? "",
    });
  }

  async function handleEdit() {
    if (!edit) return;
    const validation = validateBatchFields(edit);
    if (validation) return setEditError(validation);
    setEditError("");

    await onMutate({
      kind: "editBatch",
      id: edit.id,
      payload: {
        batch_name: edit.name.trim(),
        egg_type: edit.eggType,
        total_eggs: Number(edit.totalEggs),
        start_date: edit.startDate,
        notes: edit.notes.trim() || null,
      },
    });
    setEdit(null);
  }

  async function toggleCheck(batch: IncubatorBatch, checkKey: string, checked: boolean) {
    await onMutate({
      kind: "toggleBatchCheck",
      id: batch.id,
      checkKey,
      checked,
      notes: batch.notes,
    });
  }

  async function moveToFlock(batch: IncubatorBatch) {
    const count = Number(batch.hatched_chicks) || 0;
    if (count < 1) return;
    await onMutate({
      kind: "completeAndMove",
      batchId: batch.id,
      hatchedChicks: count,
      payload: {
        flock_name: `${batch.batch_name} chicks`,
        initial_count: count,
        start_date: toISODate(new Date()),
      },
    });
  }

  return (
    <>
      <Card>
        <SectionHeader
          icon={Egg}
          title="Incubator Tracker"
          subtitle="Chicken 21d (lockdown day 18) · Duck 28d (lockdown day 25)"
          action={
            <Button onClick={() => { resetAddForm(); setShowAdd(true); }} className="px-3 sm:px-4">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New batch</span>
            </Button>
          }
        >
          <div className="rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-100">
            <div className="flex items-center justify-between gap-2 text-xs tabular-nums">
              <span className="font-bold text-slate-700">
                {usedEggs} / {EGG_CAPACITY} eggs in use
              </span>
              <span className={nearFull ? "font-semibold text-amber-700" : "text-slate-500"}>
                {freeEggs} free
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full transition-all ${nearFull ? "bg-amber-500" : "bg-emerald-500"}`}
                style={{ width: `${usedPercent}%` }}
              />
            </div>
          </div>
        </SectionHeader>

        <div className="space-y-3 p-4 sm:p-5 md:p-6">
          {active.length === 0 && completed.length === 0 ? (
            <EmptyState
              icon={Egg}
              title="No batches yet"
              description="Add a batch to start tracking incubation days, candling and hatch counts."
            />
          ) : null}

          {active.map((batch) => {
            const p = getBatchProgress(batch);
            const canMove = (batch.hatched_chicks ?? 0) > 0;
            const checks = getBatchChecklist(batch);
            const turnKey = `turn:${p.currentDay}`;
            const candleKey = `candle:${p.currentDay}`;
            const reminderDay = candlingReminder(p.currentDay, p.spec.lockdownDay);
            const checksPaused = p.isLockdown || p.isHatching;
            const visibleNotes = stripMeta(batch.notes);

            return (
              <div
                key={batch.id}
                className={`rounded-2xl border p-4 shadow-sm sm:p-5 ${p.isLockdown ? "border-amber-200 bg-amber-50/60 ring-1 ring-amber-100" : "border-slate-200/80 bg-slate-50/60"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-base font-bold text-slate-900">{batch.batch_name}</h3>
                      <Badge tone={batch.egg_type === "duck" ? "blue" : "green"}>{p.spec.label}</Badge>
                      {p.isLockdown ? (
                        <Badge tone="amber">
                          <AlertTriangle className="h-3 w-3" /> LOCKDOWN
                        </Badge>
                      ) : null}
                      {p.isHatching ? <Badge tone="green">Hatch day</Badge> : null}
                    </div>
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500 tabular-nums">
                      <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                      Started {formatShortDate(batch.start_date)} · {batch.total_eggs} eggs
                    </p>
                  </div>
                  <div className="shrink-0 text-right tabular-nums">
                    <p className="text-xl font-extrabold leading-tight text-slate-900">
                      Day {p.currentDay}
                      <span className="text-sm font-medium text-slate-400">/{p.spec.cycleDays}</span>
                    </p>
                    <p className={`text-xs font-semibold ${p.isLockdown ? "text-amber-700" : "text-emerald-700"}`}>
                      {p.isHatching ? "Ready to hatch" : `${p.daysRemaining} days to hatch`}
                    </p>
                  </div>
                </div>

                {p.isLockdown ? (
                  <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-900">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Lockdown from day {p.spec.lockdownDay} — keep the incubator closed until hatch.
                  </div>
                ) : null}

                <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white shadow-inner">
                  <div
                    className={`h-full rounded-full transition-all ${p.isLockdown ? "bg-amber-500" : "bg-emerald-500"}`}
                    style={{ width: `${p.progress}%` }}
                  />
                </div>
                <div className="mt-1.5 flex justify-between text-[11px] text-slate-400 tabular-nums">
                  <span>Set</span>
                  <span>Lockdown · day {p.spec.lockdownDay}</span>
                  <span>Hatch</span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 tabular-nums">
                  <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Fertile (candling)
                    </p>
                    <p className="mt-0.5 text-lg font-extrabold text-slate-800">
                      {batch.fertile_eggs ?? "—"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Hatched chicks
                    </p>
                    <p className="mt-0.5 text-lg font-extrabold text-emerald-700">
                      {batch.hatched_chicks ?? "—"}
                    </p>
                  </div>
                </div>

                <div className="mt-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      <ListChecks className="h-3.5 w-3.5" /> Today&apos;s checks
                    </p>
                    <span className="text-[11px] font-semibold text-slate-400 tabular-nums">
                      Day {p.currentDay}
                    </span>
                  </div>
                  {reminderDay ? (
                    <p className="mt-2 rounded-lg bg-sky-50 px-2.5 py-1.5 text-[11px] font-medium text-sky-800">
                      Candling window around day {reminderDay} — check fertile eggs and clear infertile ones.
                    </p>
                  ) : null}
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={checksPaused}
                      onClick={() => void toggleCheck(batch, turnKey, !checks[turnKey])}
                      className={`flex min-h-12 items-center gap-2 rounded-xl px-2.5 text-left transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${
                        checks[turnKey] ? "bg-emerald-50 ring-1 ring-emerald-200" : "bg-slate-50 ring-1 ring-slate-200"
                      }`}
                    >
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${checks[turnKey] ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white"}`}>
                        {checks[turnKey] ? <Check className="h-3.5 w-3.5" /> : null}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-bold text-slate-700">Turn eggs</span>
                        <span className="block text-[10px] text-slate-400">{checksPaused ? "Paused in lockdown" : "Daily task"}</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={checksPaused}
                      onClick={() => void toggleCheck(batch, candleKey, !checks[candleKey])}
                      className={`flex min-h-12 items-center gap-2 rounded-xl px-2.5 text-left transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${
                        checks[candleKey] ? "bg-emerald-50 ring-1 ring-emerald-200" : "bg-slate-50 ring-1 ring-slate-200"
                      }`}
                    >
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${checks[candleKey] ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white"}`}>
                        {checks[candleKey] ? <Check className="h-3.5 w-3.5" /> : null}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-bold text-slate-700">Candle eggs</span>
                        <span className="block text-[10px] text-slate-400">{checksPaused ? "Paused in lockdown" : "Day 7 & 14 focus"}</span>
                      </span>
                    </button>
                  </div>
                </div>

                {visibleNotes ? (
                  <p className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-xs italic text-slate-500">
                    “{visibleNotes}”
                  </p>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button variant="secondary" onClick={() => openUpdate(batch)} className="px-3">
                    <CheckCircle2 className="h-4 w-4" /> Update counts
                  </Button>
                  {canMove ? (
                    <Button variant="amber" onClick={() => void moveToFlock(batch)} className="px-3">
                      <Bird className="h-4 w-4" /> Move chicks to flock
                    </Button>
                  ) : null}
                  <IconButton label="Edit batch" onClick={() => openEdit(batch)}>
                    <Pencil className="h-4 w-4" />
                  </IconButton>
                  <ConfirmButton
                    title="Delete batch"
                    onConfirm={() => onMutate({ kind: "deleteBatch", id: batch.id })}
                  />
                </div>
              </div>
            );
          })}

          {completed.length > 0 ? (
            <div className="border-t border-slate-100 pt-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                Completed batches
              </p>
              <div className="space-y-2">
                {completed.map((batch) => (
                  <div
                    key={batch.id}
                    className="flex min-h-[60px] flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-100"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-700">{batch.batch_name}</p>
                      <p className="text-xs text-slate-400 tabular-nums">
                        {formatShortDate(batch.start_date)} · {batch.total_eggs} eggs
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge tone="green">{batch.hatched_chicks ?? 0} hatched</Badge>
                      <IconButton label="Edit batch" onClick={() => openEdit(batch)}>
                        <Pencil className="h-4 w-4" />
                      </IconButton>
                      <ConfirmButton
                        title="Delete batch"
                        onConfirm={() => onMutate({ kind: "deleteBatch", id: batch.id })}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </Card>

      <Card>
        <SectionHeader
          icon={CheckCircle2}
          title="Hatch rate history"
          subtitle="Hatched chicks ÷ fertile eggs (or total eggs when fertility is unset)"
          action={<Badge tone="green">Avg {hatchStats.average}%</Badge>}
        />
        {hatchStats.rows.length === 0 ? (
          <EmptyState
            icon={Egg}
            title="No completed batches yet"
            description="Complete a batch with a hatch count to compare hatch rates here."
          />
        ) : (
          <div className="space-y-3 p-4 sm:p-5 md:p-6">
            {hatchStats.rows.map((row) => (
              <div key={row.id} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-800">{row.name}</p>
                    <p className="text-[11px] text-slate-400 tabular-nums">
                      {row.hatched} of {row.denominator} eggs · {formatShortDate(row.startDate)}
                    </p>
                  </div>
                  <Badge tone="green">{row.rate}% hatch</Badge>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white shadow-inner">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${row.rate}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="Start a new batch"
        description="Set the eggs in the incubator and track its 21 or 28 day cycle."
      >
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Batch name">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Batch C-03" required />
            </Field>
            <Field label="Egg type">
              <Select value={eggType} onChange={(e) => setEggType(e.target.value as EggType)}>
                <option value="chicken">Chicken — 21 days</option>
                <option value="duck">Duck — 28 days</option>
              </Select>
            </Field>
            <Field label={`Total eggs (max ${EGG_CAPACITY})`}>
              <Input type="number" min={1} max={EGG_CAPACITY} value={totalEggs} onChange={(e) => setTotalEggs(e.target.value)} required />
            </Field>
            <Field label="Start date">
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </Field>
          </div>
          <Field label="Notes (optional)">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Egg source, observations…" />
          </Field>
          <p className="text-xs text-amber-700">
            Lockdown begins on day {cycle.lockdownDay} for {cycle.label.toLowerCase()} eggs — do not
            open the incubator after that.
          </p>
          {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
          <div className="flex gap-2 pt-1">
            <Button type="submit" className="flex-1">Start batch</Button>
            <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(update && updateBatch)}
        onClose={() => setUpdate(null)}
        title="Update batch counts"
        description={updateBatch ? `${updateBatch.batch_name} · ${updateBatch.total_eggs} eggs` : undefined}
      >
        {update ? (
          <form
            onSubmit={(event) => { event.preventDefault(); void handleUpdate(); }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <Field label="Fertile eggs">
                <Input type="number" min={0} max={updateBatch?.total_eggs} value={update.fertile} onChange={(e) => setUpdate({ ...update, fertile: e.target.value })} placeholder="0" />
              </Field>
              <Field label="Hatched chicks">
                <Input type="number" min={0} max={updateBatch?.total_eggs} value={update.hatched} onChange={(e) => setUpdate({ ...update, hatched: e.target.value })} placeholder="0" />
              </Field>
            </div>
            <label className="flex min-h-12 items-center gap-3 rounded-xl bg-slate-50 px-3 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={update.complete}
                onChange={(e) => setUpdate({ ...update, complete: e.target.checked })}
                className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              Mark batch as completed
            </label>
            {updateError ? <p className="text-sm font-medium text-red-600">{updateError}</p> : null}
            <div className="flex gap-2">
              <Button type="submit" className="flex-1">Save counts</Button>
              <Button variant="secondary" onClick={() => setUpdate(null)}>Cancel</Button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(edit)}
        onClose={() => setEdit(null)}
        title="Edit batch"
        description="Fix batch details, dates or notes."
      >
        {edit ? (
          <form
            onSubmit={(event) => { event.preventDefault(); void handleEdit(); }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Batch name">
                <Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
              </Field>
              <Field label="Egg type">
                <Select value={edit.eggType} onChange={(e) => setEdit({ ...edit, eggType: e.target.value as EggType })}>
                  <option value="chicken">Chicken — 21 days</option>
                  <option value="duck">Duck — 28 days</option>
                </Select>
              </Field>
              <Field label={`Total eggs (max ${EGG_CAPACITY})`}>
                <Input type="number" min={1} max={EGG_CAPACITY} value={edit.totalEggs} onChange={(e) => setEdit({ ...edit, totalEggs: e.target.value })} />
              </Field>
              <Field label="Start date">
                <Input type="date" value={edit.startDate} onChange={(e) => setEdit({ ...edit, startDate: e.target.value })} />
              </Field>
            </div>
            <Field label="Notes (optional)">
              <Textarea value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
            </Field>
            {editError ? <p className="text-sm font-medium text-red-600">{editError}</p> : null}
            <div className="flex gap-2">
              <Button type="submit" className="flex-1">Save changes</Button>
              <Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button>
            </div>
          </form>
        ) : null}
      </Modal>

    </>
  );
}
