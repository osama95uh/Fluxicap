import { getDemoData } from "./demo-data";
import { readMeta, writeMeta } from "./farm-meta";
import { supabase } from "./supabase";
import type {
  BatchChecklist,
  EggCollection,
  FarmData,
  FarmTransaction,
  FeedAction,
  Mutation,
} from "./types";
import { newId } from "./utils";

type FeedPrevious = {
  feed_type: string;
  action_type: FeedAction;
  cost: number | null;
  log_date: string;
};

function linkedFeedExpense(
  transactions: FarmTransaction[],
  previous: FeedPrevious,
): FarmTransaction | undefined {
  if (previous.action_type !== "purchase") return undefined;
  return transactions.find(
    (transaction) =>
      transaction.type === "expense" &&
      transaction.category === "Feed" &&
      transaction.description === `${previous.feed_type} purchase` &&
      Number(transaction.amount) === Number(previous.cost) &&
      transaction.transaction_date === previous.log_date,
  );
}

async function findLinkedExpenseId(previous: FeedPrevious): Promise<string | null> {
  if (!supabase || previous.action_type !== "purchase") return null;
  const { data, error } = await supabase
    .from("transactions")
    .select("id")
    .eq("type", "expense")
    .eq("category", "Feed")
    .eq("description", `${previous.feed_type} purchase`)
    .eq("amount", Number(previous.cost) || 0)
    .eq("transaction_date", previous.log_date)
    .limit(1);
  if (error) throw error;
  const rows = (data ?? []) as unknown as { id: string }[];
  return rows[0]?.id ?? null;
}

function updatedChecklistNotes(mutation: Extract<Mutation, { kind: "toggleBatchCheck" }>): string {
  const checks = readMeta<BatchChecklist>(mutation.notes, "checks") ?? {};
  return writeMeta(mutation.notes, "checks", { ...checks, [mutation.checkKey]: mutation.checked });
}

function updatedEggNotes(mutation: Extract<Mutation, { kind: "logEggCollection" }>): string {
  const collection: EggCollection = {
    collected: mutation.collected,
    spoiled: mutation.spoiled,
    sold: mutation.sold,
  };
  return writeMeta(mutation.notes, "eggs", collection);
}

export interface LoadResult {
  data: FarmData;
  demo: boolean;
  error?: string;
}

export async function loadFarmData(): Promise<LoadResult> {
  if (!supabase) return { data: getDemoData(), demo: true };

  try {
    const [batches, flocks, flockLogs, feedLogs, transactions] = await Promise.all([
      supabase.from("incubator_batches").select("*").order("start_date", { ascending: false }),
      supabase.from("poultry_flocks").select("*").order("start_date", { ascending: false }),
      supabase.from("flock_logs").select("*").order("log_date", { ascending: false }),
      supabase.from("feed_logs").select("*").order("log_date", { ascending: false }),
      supabase
        .from("transactions")
        .select("*")
        .order("transaction_date", { ascending: false }),
    ]);

    const failure =
      batches.error ?? flocks.error ?? flockLogs.error ?? feedLogs.error ?? transactions.error;
    if (failure) {
      return { data: getDemoData(), demo: true, error: failure.message };
    }

    return {
      data: {
        batches: batches.data ?? [],
        flocks: flocks.data ?? [],
        flockLogs: flockLogs.data ?? [],
        feedLogs: feedLogs.data ?? [],
        transactions: transactions.data ?? [],
      },
      demo: false,
    };
  } catch (error) {
    return {
      data: getDemoData(),
      demo: true,
      error: error instanceof Error ? error.message : "Could not load farm data.",
    };
  }
}

export function applyMutationLocal(data: FarmData, mutation: Mutation): FarmData {
  switch (mutation.kind) {
    case "addBatch":
      return {
        ...data,
        batches: [
          {
            id: newId(),
            ...mutation.payload,
            fertile_eggs: null,
            hatched_chicks: null,
            status: "active",
          },
          ...data.batches,
        ],
      };

    case "updateBatch":
      return {
        ...data,
        batches: data.batches.map((batch) =>
          batch.id === mutation.id ? { ...batch, ...mutation.payload } : batch,
        ),
      };

    case "addFlock":
      return {
        ...data,
        flocks: [
          {
            id: newId(),
            ...mutation.payload,
            current_count: mutation.payload.initial_count,
            status: "active",
          },
          ...data.flocks,
        ],
      };

    case "logMortality":
      return {
        ...data,
        flocks: data.flocks.map((flock) =>
          flock.id === mutation.flockId
            ? {
                ...flock,
                current_count: mutation.newCount,
                status: mutation.newStatus ?? flock.status,
              }
            : flock,
        ),
        flockLogs: [
          { id: newId(), flock_id: mutation.flockId, ...mutation.payload },
          ...data.flockLogs,
        ],
      };

    case "addFeedLog":
      return {
        ...data,
        feedLogs: [
          {
            id: newId(),
            feed_type: mutation.payload.feed_type,
            action_type: mutation.payload.action_type,
            quantity_kg: mutation.payload.quantity_kg,
            cost: mutation.payload.cost,
            log_date: mutation.payload.log_date,
          },
          ...data.feedLogs,
        ],
        transactions: mutation.payload.createExpense
          ? [
              {
                id: newId(),
                type: "expense" as const,
                category: "Feed",
                amount: Number(mutation.payload.cost) || 0,
                description: `${mutation.payload.feed_type} purchase`,
                transaction_date: mutation.payload.log_date,
              },
              ...data.transactions,
            ]
          : data.transactions,
      };

    case "addTransaction":
      return {
        ...data,
        transactions: [{ id: newId(), ...mutation.payload }, ...data.transactions],
      };

    case "editBatch":
      return {
        ...data,
        batches: data.batches.map((batch) =>
          batch.id === mutation.id ? { ...batch, ...mutation.payload } : batch,
        ),
      };

    case "deleteBatch":
      return { ...data, batches: data.batches.filter((batch) => batch.id !== mutation.id) };

    case "completeAndMove":
      return {
        ...data,
        batches: data.batches.map((batch) =>
          batch.id === mutation.batchId
            ? { ...batch, status: "completed", hatched_chicks: mutation.hatchedChicks }
            : batch,
        ),
        flocks: [
          {
            id: newId(),
            ...mutation.payload,
            current_count: mutation.payload.initial_count,
            status: "active",
          },
          ...data.flocks,
        ],
      };

    case "editFeedLog": {
      const feedLogs = data.feedLogs.map((log) =>
        log.id === mutation.id ? { ...log, ...mutation.payload } : log,
      );
      const linked = linkedFeedExpense(data.transactions, mutation.previous);
      let transactions = data.transactions;

      if (mutation.payload.action_type === "purchase") {
        const expense = {
          id: linked?.id ?? newId(),
          type: "expense" as const,
          category: "Feed",
          amount: Number(mutation.payload.cost) || 0,
          description: `${mutation.payload.feed_type} purchase`,
          transaction_date: mutation.payload.log_date,
        };
        transactions = linked
          ? transactions.map((transaction) =>
              transaction.id === linked.id ? expense : transaction,
            )
          : [expense, ...transactions];
      } else if (linked) {
        transactions = transactions.filter((transaction) => transaction.id !== linked.id);
      }

      return { ...data, feedLogs, transactions };
    }

    case "deleteFeedLog": {
      const linked = linkedFeedExpense(data.transactions, mutation.previous);
      return {
        ...data,
        feedLogs: data.feedLogs.filter((log) => log.id !== mutation.id),
        transactions: linked
          ? data.transactions.filter((transaction) => transaction.id !== linked.id)
          : data.transactions,
      };
    }

    case "editTransaction":
      return {
        ...data,
        transactions: data.transactions.map((transaction) =>
          transaction.id === mutation.id ? { ...transaction, ...mutation.payload } : transaction,
        ),
      };

    case "deleteTransaction":
      return {
        ...data,
        transactions: data.transactions.filter((transaction) => transaction.id !== mutation.id),
      };

    case "toggleBatchCheck": {
      const notes = updatedChecklistNotes(mutation);
      return {
        ...data,
        batches: data.batches.map((batch) =>
          batch.id === mutation.id ? { ...batch, notes } : batch,
        ),
      };
    }

    case "logEggCollection": {
      const log = {
        id: mutation.logId ?? newId(),
        flock_id: mutation.flockId,
        log_date: mutation.log_date,
        mortality_count: 0,
        vaccine_or_medicine: null,
        notes: updatedEggNotes(mutation),
      };
      return {
        ...data,
        flockLogs: mutation.logId
          ? data.flockLogs.map((item) => (item.id === mutation.logId ? log : item))
          : [log, ...data.flockLogs],
      };
    }
  }
}

export async function persistMutation(
  mutation: Mutation,
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: true };

  try {
    switch (mutation.kind) {
      case "addBatch": {
        const { error } = await supabase.from("incubator_batches").insert(mutation.payload);
        if (error) throw error;
        break;
      }
      case "updateBatch": {
        const { error } = await supabase
          .from("incubator_batches")
          .update(mutation.payload)
          .eq("id", mutation.id);
        if (error) throw error;
        break;
      }
      case "addFlock": {
        const { error } = await supabase
          .from("poultry_flocks")
          .insert({ ...mutation.payload, current_count: mutation.payload.initial_count });
        if (error) throw error;
        break;
      }
      case "logMortality": {
        const { error: logError } = await supabase.from("flock_logs").insert({
          flock_id: mutation.flockId,
          ...mutation.payload,
        });
        if (logError) throw logError;

        const { error: flockError } = await supabase
          .from("poultry_flocks")
          .update({
            current_count: mutation.newCount,
            ...(mutation.newStatus ? { status: mutation.newStatus } : {}),
          })
          .eq("id", mutation.flockId);
        if (flockError) throw flockError;
        break;
      }
      case "addFeedLog": {
        const { error: feedError } = await supabase.from("feed_logs").insert({
          feed_type: mutation.payload.feed_type,
          action_type: mutation.payload.action_type,
          quantity_kg: mutation.payload.quantity_kg,
          cost: mutation.payload.cost,
          log_date: mutation.payload.log_date,
        });
        if (feedError) throw feedError;

        if (mutation.payload.createExpense) {
          const { error: txnError } = await supabase.from("transactions").insert({
            type: "expense",
            category: "Feed",
            amount: Number(mutation.payload.cost) || 0,
            description: `${mutation.payload.feed_type} purchase`,
            transaction_date: mutation.payload.log_date,
          });
          if (txnError) throw txnError;
        }
        break;
      }
      case "addTransaction": {
        const { error } = await supabase.from("transactions").insert(mutation.payload);
        if (error) throw error;
        break;
      }
      case "editBatch": {
        const { error } = await supabase
          .from("incubator_batches")
          .update(mutation.payload)
          .eq("id", mutation.id);
        if (error) throw error;
        break;
      }
      case "deleteBatch": {
        const { error } = await supabase
          .from("incubator_batches")
          .delete()
          .eq("id", mutation.id);
        if (error) throw error;
        break;
      }
      case "completeAndMove": {
        const { error: batchError } = await supabase
          .from("incubator_batches")
          .update({ status: "completed", hatched_chicks: mutation.hatchedChicks })
          .eq("id", mutation.batchId);
        if (batchError) throw batchError;

        const { error: flockError } = await supabase.from("poultry_flocks").insert({
          ...mutation.payload,
          current_count: mutation.payload.initial_count,
        });
        if (flockError) throw flockError;
        break;
      }
      case "editFeedLog": {
        const { error: feedError } = await supabase
          .from("feed_logs")
          .update(mutation.payload)
          .eq("id", mutation.id);
        if (feedError) throw feedError;

        const linkedId = await findLinkedExpenseId(mutation.previous);
        if (mutation.payload.action_type === "purchase") {
          const expense = {
            type: "expense" as const,
            category: "Feed",
            amount: Number(mutation.payload.cost) || 0,
            description: `${mutation.payload.feed_type} purchase`,
            transaction_date: mutation.payload.log_date,
          };
          const { error: txnError } = linkedId
            ? await supabase.from("transactions").update(expense).eq("id", linkedId)
            : await supabase.from("transactions").insert(expense);
          if (txnError) throw txnError;
        } else if (linkedId) {
          const { error: txnError } = await supabase
            .from("transactions")
            .delete()
            .eq("id", linkedId);
          if (txnError) throw txnError;
        }
        break;
      }
      case "deleteFeedLog": {
        const { error: feedError } = await supabase
          .from("feed_logs")
          .delete()
          .eq("id", mutation.id);
        if (feedError) throw feedError;

        const linkedId = await findLinkedExpenseId(mutation.previous);
        if (linkedId) {
          const { error: txnError } = await supabase
            .from("transactions")
            .delete()
            .eq("id", linkedId);
          if (txnError) throw txnError;
        }
        break;
      }
      case "editTransaction": {
        const { error } = await supabase
          .from("transactions")
          .update(mutation.payload)
          .eq("id", mutation.id);
        if (error) throw error;
        break;
      }
      case "deleteTransaction": {
        const { error } = await supabase
          .from("transactions")
          .delete()
          .eq("id", mutation.id);
        if (error) throw error;
        break;
      }
      case "toggleBatchCheck": {
        const { error } = await supabase
          .from("incubator_batches")
          .update({ notes: updatedChecklistNotes(mutation) })
          .eq("id", mutation.id);
        if (error) throw error;
        break;
      }
      case "logEggCollection": {
        const payload = {
          flock_id: mutation.flockId,
          log_date: mutation.log_date,
          mortality_count: 0,
          vaccine_or_medicine: null,
          notes: updatedEggNotes(mutation),
        };
        const { error } = mutation.logId
          ? await supabase.from("flock_logs").update(payload).eq("id", mutation.logId)
          : await supabase.from("flock_logs").insert(payload);
        if (error) throw error;
        break;
      }
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not save the change.",
    };
  }
}
