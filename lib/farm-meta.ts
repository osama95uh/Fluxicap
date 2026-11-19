// Small structured blocks stored inside existing `notes` text columns.
// This keeps the five-table Supabase schema unchanged while allowing the
// requested checklist and daily egg logs to persist.

export type MetaKey = "checks" | "eggs";

const BLOCK_PATTERN = /\[farm:(checks|eggs)\]([\s\S]*?)\[\/farm:\1\]/g;

function patternFor(key: MetaKey): RegExp {
  return new RegExp(`\\[farm:${key}\\]([\\s\\S]*?)\\[/farm:${key}\\]`, "g");
}

export function readMeta<T>(notes: string | null | undefined, key: MetaKey): T | null {
  if (!notes) return null;
  const match = patternFor(key).exec(notes);
  if (!match?.[1]) return null;
  try {
    return JSON.parse(match[1]) as T;
  } catch {
    return null;
  }
}

export function stripMeta(notes: string | null | undefined): string {
  if (!notes) return "";
  return notes.replace(BLOCK_PATTERN, "").replace(/\n{3,}/g, "\n\n").trim();
}

export function writeMeta<T>(
  notes: string | null | undefined,
  key: MetaKey,
  value: T,
): string {
  const visible = stripMeta(notes);
  const block = `[farm:${key}]${JSON.stringify(value)}[/farm:${key}]`;
  return visible ? `${visible}\n\n${block}` : block;
}
