import type { FarmData } from "./types";
import { toISODate } from "./utils";

export type BackupFormat = "json" | "csv";

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(",");
}

export function buildFarmCsv(data: FarmData): string {
  const rows: unknown[][] = [
    ["record_type", "id", "date", "name_or_category", "value", "details", "notes"],
  ];

  for (const batch of data.batches) {
    rows.push([
      "incubator_batch",
      batch.id,
      batch.start_date,
      batch.batch_name,
      batch.total_eggs,
      `${batch.egg_type}; fertile=${batch.fertile_eggs ?? ""}; hatched=${batch.hatched_chicks ?? ""}; status=${batch.status}`,
      batch.notes ?? "",
    ]);
  }
  for (const flock of data.flocks) {
    rows.push([
      "poultry_flock",
      flock.id,
      flock.start_date,
      flock.flock_name,
      flock.current_count,
      `initial=${flock.initial_count}; status=${flock.status}`,
      "",
    ]);
  }
  for (const log of data.flockLogs) {
    rows.push([
      "flock_log",
      log.id,
      log.log_date,
      log.vaccine_or_medicine ?? "",
      log.mortality_count,
      `flock_id=${log.flock_id}`,
      log.notes ?? "",
    ]);
  }
  for (const log of data.feedLogs) {
    rows.push([
      "feed_log",
      log.id,
      log.log_date,
      log.feed_type,
      log.quantity_kg,
      `${log.action_type}; cost=${log.cost ?? ""}`,
      "",
    ]);
  }
  for (const transaction of data.transactions) {
    rows.push([
      "transaction",
      transaction.id,
      transaction.transaction_date,
      transaction.category,
      transaction.amount,
      `${transaction.type}; ${transaction.description ?? ""}`,
      "",
    ]);
  }

  return rows.map(csvRow).join("\r\n");
}

export function buildFarmJson(data: FarmData): string {
  return JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      app: "Farm Manager",
      data,
    },
    null,
    2,
  );
}

export function downloadFarmBackup(data: FarmData, format: BackupFormat): void {
  const isJson = format === "json";
  const content = isJson ? buildFarmJson(data) : buildFarmCsv(data);
  const blob = new Blob([content], {
    type: isJson ? "application/json;charset=utf-8" : "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `farm-backup-${toISODate(new Date())}.${format}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
