export type PageId = "overview" | "incubator" | "flocks" | "feed" | "finance";

export type FormRequest = {
  target: "batch" | "batchUpdate" | "flock" | "feed" | "transaction";
  page: PageId;
  id?: string;
  nonce: number;
} | null;

export type EggType = "chicken" | "duck";
export type BatchStatus = "active" | "completed";
export type FlockStatus = "active" | "sold_out";
export type TransactionType = "income" | "expense";
export type FeedAction = "purchase" | "consume";

export interface IncubatorBatch {
  id: string;
  batch_name: string;
  egg_type: EggType;
  total_eggs: number;
  fertile_eggs: number | null;
  hatched_chicks: number | null;
  start_date: string;
  status: BatchStatus;
  notes: string | null;
}

export interface PoultryFlock {
  id: string;
  flock_name: string;
  initial_count: number;
  current_count: number;
  start_date: string;
  status: FlockStatus;
}

export interface FlockLog {
  id: string;
  flock_id: string;
  log_date: string;
  mortality_count: number;
  vaccine_or_medicine: string | null;
  notes: string | null;
}

export interface FeedLog {
  id: string;
  feed_type: string;
  action_type: FeedAction;
  quantity_kg: number;
  cost: number | null;
  log_date: string;
}

export interface FarmTransaction {
  id: string;
  type: TransactionType;
  category: string;
  amount: number;
  description: string | null;
  transaction_date: string;
}

export interface FarmData {
  batches: IncubatorBatch[];
  flocks: PoultryFlock[];
  flockLogs: FlockLog[];
  feedLogs: FeedLog[];
  transactions: FarmTransaction[];
}

export type BatchChecklist = Record<string, boolean>;

export interface EggCollection {
  collected: number;
  spoiled: number;
  sold: number;
}

export const EGG_CAPACITY = 188;
export const LOW_FEED_THRESHOLD = 20;

export const INCUBATOR_CYCLES: Record<
  EggType,
  { cycleDays: number; lockdownDay: number; label: string }
> = {
  chicken: { cycleDays: 21, lockdownDay: 18, label: "Chicken" },
  duck: { cycleDays: 28, lockdownDay: 25, label: "Duck" },
};

export type Mutation =
  | {
      kind: "addBatch";
      payload: {
        batch_name: string;
        egg_type: EggType;
        total_eggs: number;
        start_date: string;
        notes: string | null;
      };
    }
  | {
      kind: "updateBatch";
      id: string;
      payload: {
        fertile_eggs?: number | null;
        hatched_chicks?: number | null;
        status?: BatchStatus;
      };
    }
  | {
      kind: "addFlock";
      payload: {
        flock_name: string;
        initial_count: number;
        start_date: string;
      };
    }
  | {
      kind: "logMortality";
      flockId: string;
      newCount: number;
      newStatus?: FlockStatus;
      payload: {
        log_date: string;
        mortality_count: number;
        vaccine_or_medicine: string | null;
        notes: string | null;
      };
    }
  | {
      kind: "addFeedLog";
      payload: {
        feed_type: string;
        action_type: FeedAction;
        quantity_kg: number;
        cost: number | null;
        log_date: string;
        createExpense: boolean;
      };
    }
  | {
      kind: "addTransaction";
      payload: {
        type: TransactionType;
        category: string;
        amount: number;
        description: string | null;
        transaction_date: string;
      };
    }
  | {
      kind: "editBatch";
      id: string;
      payload: {
        batch_name: string;
        egg_type: EggType;
        total_eggs: number;
        start_date: string;
        notes: string | null;
      };
    }
  | { kind: "deleteBatch"; id: string }
  | {
      kind: "completeAndMove";
      batchId: string;
      hatchedChicks: number;
      payload: {
        flock_name: string;
        initial_count: number;
        start_date: string;
      };
    }
  | {
      kind: "editFeedLog";
      id: string;
      previous: {
        feed_type: string;
        action_type: FeedAction;
        cost: number | null;
        log_date: string;
      };
      payload: {
        feed_type: string;
        action_type: FeedAction;
        quantity_kg: number;
        cost: number | null;
        log_date: string;
      };
    }
  | {
      kind: "deleteFeedLog";
      id: string;
      previous: {
        feed_type: string;
        action_type: FeedAction;
        cost: number | null;
        log_date: string;
      };
    }
  | {
      kind: "editTransaction";
      id: string;
      payload: {
        type: TransactionType;
        category: string;
        amount: number;
        description: string | null;
        transaction_date: string;
      };
    }
  | { kind: "deleteTransaction"; id: string }
  | {
      kind: "toggleBatchCheck";
      id: string;
      checkKey: string;
      checked: boolean;
      notes: string | null;
    }
  | {
      kind: "logEggCollection";
      flockId: string;
      logId?: string;
      log_date: string;
      collected: number;
      spoiled: number;
      sold: number;
      notes: string | null;
    };

