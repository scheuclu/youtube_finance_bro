import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DB_URL =
  process.env.KB_DB_URL ??
  "https://raw.githubusercontent.com/scheuclu/youtube_finance_bro/main/data/kb.sqlite3";
const TTL_MS = 120_000;
/** Grace period before closing a superseded handle that in-flight queries may still hold. */
const RETIRE_MS = 60_000;

let cached: { db: Database.Database; file: string; fetchedAt: number } | null = null;
let inflight: Promise<Database.Database> | null = null;
let seq = 0;

function retire(entry: { db: Database.Database; file: string }) {
  const timer = setTimeout(() => {
    try {
      entry.db.close();
    } catch {
      /* already closed */
    }
    fs.rm(entry.file, { force: true }, () => {});
  }, RETIRE_MS);
  timer.unref?.();
}

async function refresh(): Promise<Database.Database> {
  const resp = await fetch(`${DB_URL}?t=${Date.now()}`, { cache: "no-store" });
  if (!resp.ok) {
    if (cached) return cached.db; // stale is better than broken
    throw new Error(`knowledge base fetch failed: ${resp.status}`);
  }
  const buf = Buffer.from(await resp.arrayBuffer());

  // Each refresh gets its own file: overwriting a file that an open handle is
  // reading can corrupt in-flight reads.
  const file = path.join(os.tmpdir(), `kb-${process.pid}-${seq++}.sqlite3`);
  fs.writeFileSync(file, buf);
  const db = new Database(file, { readonly: true, fileMustExist: true });

  const previous = cached;
  cached = { db, file, fetchedAt: Date.now() };
  if (previous) retire(previous);
  return db;
}

/**
 * The committed knowledge base, opened read-only with a short TTL.
 *
 * Concurrent callers (server components render in parallel) share a single
 * in-flight refresh, and a superseded handle is only closed after a grace
 * period — otherwise one render closes the database another is still reading.
 */
export async function getDb(): Promise<Database.Database> {
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) return cached.db;
  if (!inflight) {
    inflight = refresh().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}
