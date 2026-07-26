import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DB_URL =
  process.env.KB_DB_URL ??
  "https://raw.githubusercontent.com/scheuclu/youtube_finance_bro/main/data/kb.sqlite3";
const TTL_MS = 120_000;

const DB_FILE = path.join(os.tmpdir(), "kb.sqlite3");

let cached: { db: Database.Database; fetchedAt: number } | null = null;

/** Download the committed knowledge base (with a short TTL) and open it read-only. */
export async function getDb(): Promise<Database.Database> {
  const now = Date.now();
  if (cached && now - cached.fetchedAt < TTL_MS) return cached.db;

  const resp = await fetch(`${DB_URL}?t=${now}`, { cache: "no-store" });
  if (!resp.ok) {
    if (cached) return cached.db; // stale is better than broken
    throw new Error(`knowledge base fetch failed: ${resp.status}`);
  }
  const buf = Buffer.from(await resp.arrayBuffer());
  cached?.db.close();
  fs.writeFileSync(DB_FILE, buf);
  const db = new Database(DB_FILE, { readonly: true, fileMustExist: true });
  cached = { db, fetchedAt: now };
  return db;
}
