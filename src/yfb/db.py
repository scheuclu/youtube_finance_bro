"""SQLite persistence: schema, migrations, and repository helpers.

The DB file (data/kb.sqlite3) is the single source of pipeline state and is
committed back to the repo by the GitHub Actions workflow.

Item status state machine:
    seen_skipped        recorded on first sight of a source; never processed
    new                 awaiting transcript
    pending_transcript  transient transcript failure; retried on later runs
    transcript_failed   gave up on transcript; metadata-only notification
    summarized          analysis stored; awaiting Telegram notification
    notified            done
    failed              permanent failure (e.g. model refusal)
"""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

SCHEMA_VERSION = 1

_DDL = """
CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL,
  external_id TEXT NOT NULL,
  name TEXT,
  config_json TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (kind, external_id)
);

CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY,
  source_id INTEGER NOT NULL REFERENCES sources(id),
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  published_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  transcript_attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  first_seen_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (source_id, external_id)
);
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);

CREATE TABLE IF NOT EXISTS transcripts (
  item_id INTEGER PRIMARY KEY REFERENCES items(id),
  text TEXT NOT NULL,
  language TEXT,
  is_generated INTEGER,
  fetched_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS summaries (
  item_id INTEGER PRIMARY KEY REFERENCES items(id),
  tldr TEXT NOT NULL,
  summary_md TEXT NOT NULL,
  macro_view TEXT,
  overall_sentiment TEXT,
  model TEXT NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  raw_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ticker_mentions (
  id INTEGER PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES items(id),
  ticker TEXT NOT NULL,
  asset_name TEXT,
  stance TEXT NOT NULL,
  sentiment TEXT NOT NULL,
  thesis TEXT,
  price_target REAL,
  price_target_currency TEXT,
  time_horizon TEXT,
  confidence TEXT,
  quote TEXT
);
CREATE INDEX IF NOT EXISTS idx_mentions_ticker ON ticker_mentions(ticker);

CREATE VIRTUAL TABLE IF NOT EXISTS kb_fts USING fts5(
  content, content_type, item_id UNINDEXED, tokenize='porter unicode61'
);

-- Created now, populated in v2 (Voyage + sqlite-vec).
CREATE TABLE IF NOT EXISTS embeddings (
  id INTEGER PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES items(id),
  chunk_kind TEXT NOT NULL,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  model TEXT NOT NULL,
  vector BLOB NOT NULL
);
"""


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def connect(db_path: Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    _migrate(conn)
    return conn


def _migrate(conn: sqlite3.Connection) -> None:
    version = conn.execute("PRAGMA user_version").fetchone()[0]
    if version < 1:
        conn.executescript(_DDL)
        conn.execute(f"PRAGMA user_version = {SCHEMA_VERSION}")
        conn.commit()


# --- sources ---------------------------------------------------------------

def upsert_source(conn: sqlite3.Connection, kind: str, external_id: str, name: str | None) -> tuple[int, bool]:
    """Return (source_id, created)."""
    row = conn.execute(
        "SELECT id FROM sources WHERE kind = ? AND external_id = ?", (kind, external_id)
    ).fetchone()
    if row:
        if name:
            conn.execute("UPDATE sources SET name = ? WHERE id = ?", (name, row["id"]))
        return row["id"], False
    cur = conn.execute(
        "INSERT INTO sources (kind, external_id, name, created_at) VALUES (?, ?, ?, ?)",
        (kind, external_id, name, now_iso()),
    )
    assert cur.lastrowid is not None
    return cur.lastrowid, True


# --- items -----------------------------------------------------------------

def insert_item(
    conn: sqlite3.Connection,
    source_id: int,
    external_id: str,
    title: str,
    url: str,
    published_at: str,
    status: str,
) -> int | None:
    """Insert if unseen; return new item id or None if already known."""
    ts = now_iso()
    cur = conn.execute(
        """INSERT INTO items (source_id, external_id, title, url, published_at,
                              status, first_seen_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (source_id, external_id) DO NOTHING""",
        (source_id, external_id, title, url, published_at, status, ts, ts),
    )
    return cur.lastrowid if cur.rowcount else None


def set_status(conn: sqlite3.Connection, item_id: int, status: str, error: str | None = None) -> None:
    conn.execute(
        "UPDATE items SET status = ?, last_error = ?, updated_at = ? WHERE id = ?",
        (status, error, now_iso(), item_id),
    )


def bump_transcript_attempts(conn: sqlite3.Connection, item_id: int) -> int:
    conn.execute(
        "UPDATE items SET transcript_attempts = transcript_attempts + 1, updated_at = ? WHERE id = ?",
        (now_iso(), item_id),
    )
    return conn.execute(
        "SELECT transcript_attempts FROM items WHERE id = ?", (item_id,)
    ).fetchone()[0]


def items_by_status(conn: sqlite3.Connection, *statuses: str) -> list[sqlite3.Row]:
    placeholders = ",".join("?" * len(statuses))
    return conn.execute(
        f"""SELECT items.*, sources.name AS source_name, sources.external_id AS source_external_id
            FROM items JOIN sources ON sources.id = items.source_id
            WHERE status IN ({placeholders})
            ORDER BY published_at ASC""",
        statuses,
    ).fetchall()


# --- transcripts / summaries / mentions -------------------------------------

def store_transcript(conn: sqlite3.Connection, item_id: int, text: str, language: str | None, is_generated: bool | None) -> None:
    conn.execute(
        """INSERT OR REPLACE INTO transcripts (item_id, text, language, is_generated, fetched_at)
           VALUES (?, ?, ?, ?, ?)""",
        (item_id, text, language, None if is_generated is None else int(is_generated), now_iso()),
    )


def get_transcript(conn: sqlite3.Connection, item_id: int) -> str | None:
    row = conn.execute("SELECT text FROM transcripts WHERE item_id = ?", (item_id,)).fetchone()
    return row["text"] if row else None


def store_analysis(
    conn: sqlite3.Connection,
    item_id: int,
    analysis: dict,
    model: str,
    input_tokens: int | None,
    output_tokens: int | None,
) -> None:
    """Store summary + ticker mentions + FTS rows in one transaction."""
    conn.execute(
        """INSERT OR REPLACE INTO summaries
           (item_id, tldr, summary_md, macro_view, overall_sentiment, model,
            input_tokens, output_tokens, raw_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            item_id,
            analysis["tldr"],
            analysis["summary_md"],
            analysis.get("macro_view"),
            analysis.get("overall_sentiment"),
            model,
            input_tokens,
            output_tokens,
            json.dumps(analysis),
            now_iso(),
        ),
    )
    conn.execute("DELETE FROM ticker_mentions WHERE item_id = ?", (item_id,))
    conn.execute("DELETE FROM kb_fts WHERE item_id = ?", (item_id,))

    for m in analysis.get("tickers", []):
        conn.execute(
            """INSERT INTO ticker_mentions
               (item_id, ticker, asset_name, stance, sentiment, thesis,
                price_target, price_target_currency, time_horizon, confidence, quote)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                item_id,
                m["ticker"].upper(),
                m.get("asset_name"),
                m["stance"],
                m["sentiment"],
                m.get("thesis"),
                m.get("price_target"),
                m.get("price_target_currency"),
                m.get("time_horizon"),
                m.get("confidence"),
                m.get("quote"),
            ),
        )
        if m.get("thesis"):
            conn.execute(
                "INSERT INTO kb_fts (content, content_type, item_id) VALUES (?, ?, ?)",
                (f"{m['ticker'].upper()} {m.get('asset_name') or ''}: {m['thesis']}", "thesis", item_id),
            )

    conn.execute(
        "INSERT INTO kb_fts (content, content_type, item_id) VALUES (?, ?, ?)",
        (f"{analysis['tldr']}\n{analysis['summary_md']}", "summary", item_id),
    )


def get_summary(conn: sqlite3.Connection, item_id: int) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM summaries WHERE item_id = ?", (item_id,)).fetchone()


def get_mentions(conn: sqlite3.Connection, item_id: int) -> list[sqlite3.Row]:
    return conn.execute(
        "SELECT * FROM ticker_mentions WHERE item_id = ? ORDER BY id", (item_id,)
    ).fetchall()
