import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { getDemoData } from "../lib/demo-data";

// tsx does not load Next.js env files automatically.
try {
  const contents = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 0) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
} catch {
  // Fall back to environment variables already set in the shell.
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing Supabase URL or key. Set them in .env.local before seeding.");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function existingValues(table: string, column: string): Promise<Set<string>> {
  const { data, error } = await supabase.from(table).select(column);
  if (error) throw error;
  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  return new Set(rows.map((row) => String(row[column])));
}

async function insert(table: string, rows: Record<string, unknown>[]): Promise<number> {
  if (rows.length === 0) return 0;
  const { error } = await supabase.from(table).insert(rows);
  if (error) throw error;
  return rows.length;
}

async function main() {
  const demo = getDemoData();
  let inserted = 0;

  const batchNames = await existingValues("incubator_batches", "batch_name");
  inserted += await insert(
    "incubator_batches",
    demo.batches
      .filter((batch) => !batchNames.has(batch.batch_name))
      .map(({ id: _id, ...batch }) => batch as unknown as Record<string, unknown>),
  );

  const flockNames = await existingValues("poultry_flocks", "flock_name");
  const flockIdMap = new Map<string, string>();

  const { data: allFlocks, error: flockError } = await supabase
    .from("poultry_flocks")
    .select("id, flock_name");
  if (flockError) throw flockError;
  const flockRows = (allFlocks ?? []) as unknown as Record<string, unknown>[];
  for (const flock of demo.flocks) {
    const match = flockRows.find((row) => row.flock_name === flock.flock_name);
    if (match) flockIdMap.set(flock.id, String(match.id));
  }

  for (const flock of demo.flocks) {
    if (flockNames.has(flock.flock_name)) continue;
    const { data, error } = await supabase
      .from("poultry_flocks")
      .insert({
        flock_name: flock.flock_name,
        initial_count: flock.initial_count,
        current_count: flock.current_count,
        start_date: flock.start_date,
        status: flock.status,
      })
      .select("id")
      .single();
    if (error) throw error;
    if (data) flockIdMap.set(flock.id, String(data.id));
    inserted += 1;
  }

  inserted += await insert(
    "flock_logs",
    demo.flockLogs
      .map((log) => ({ ...log, flock_id: flockIdMap.get(log.flock_id) }))
      .filter((log) => Boolean(log.flock_id))
      .map(({ id: _id, ...log }) => log as unknown as Record<string, unknown>),
  );

  const feedKeys = await existingValues("feed_logs", "feed_type");
  inserted += await insert(
    "feed_logs",
    demo.feedLogs
      .filter((log) => !feedKeys.has(log.feed_type))
      .map(({ id: _id, ...log }) => log as unknown as Record<string, unknown>),
  );

  const txnKeys = await existingValues("transactions", "description");
  inserted += await insert(
    "transactions",
    demo.transactions
      .filter((txn) => !txnKeys.has(txn.description ?? ""))
      .map(({ id: _id, ...txn }) => txn as unknown as Record<string, unknown>),
  );

  console.log(`Seed complete: ${inserted} row(s) inserted. Existing rows were skipped.`);
}

main().catch((error) => {
  console.error("Seed failed:", error instanceof Error ? error.message : error);
  console.error(
    "If this is a permission error, check your RLS policies for the anon role or set SUPABASE_SERVICE_ROLE_KEY in .env.local.",
  );
  process.exitCode = 1;
});
