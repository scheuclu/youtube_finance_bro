"""Knowledge-base querying: structured ticker lookup + FTS5 search,
with optional Gemini answer synthesis (--answer)."""

from __future__ import annotations

import re
import sqlite3
from datetime import datetime, timedelta, timezone

from . import db
from .config import Config

TICKER_RE = re.compile(r"\b[A-Z]{1,6}\b")
# Common English words that look like tickers in an all-caps query token.
TICKER_STOPWORDS = {"A", "I", "THE", "AND", "OR", "ON", "IN", "OF", "TO", "IS", "WHAT", "ETF", "AI"}


def _since_clause(since_days: int | None) -> tuple[str, list]:
    if not since_days:
        return "", []
    cutoff = (datetime.now(timezone.utc) - timedelta(days=since_days)).strftime("%Y-%m-%dT%H:%M:%SZ")
    return " AND items.published_at >= ?", [cutoff]


def ticker_lookup(conn: sqlite3.Connection, ticker: str, since_days: int | None = None) -> list[sqlite3.Row]:
    clause, params = _since_clause(since_days)
    return conn.execute(
        f"""SELECT items.published_at, sources.name AS channel, items.title, items.url,
                   tm.ticker, tm.stance, tm.sentiment, tm.thesis,
                   tm.price_target, tm.price_target_currency, tm.time_horizon
            FROM ticker_mentions tm
            JOIN items ON items.id = tm.item_id
            JOIN sources ON sources.id = items.source_id
            WHERE tm.ticker = ?{clause}
            ORDER BY items.published_at DESC""",
        [ticker.upper(), *params],
    ).fetchall()


def fts_search(conn: sqlite3.Connection, query: str, limit: int = 10) -> list[sqlite3.Row]:
    # Quote each term to keep FTS5 syntax characters from breaking the query.
    terms = " ".join(f'"{t}"' for t in re.findall(r"\w+", query))
    if not terms:
        return []
    return conn.execute(
        """SELECT kb_fts.content, kb_fts.content_type, items.title, items.url,
                  items.published_at, sources.name AS channel
           FROM kb_fts
           JOIN items ON items.id = kb_fts.item_id
           JOIN sources ON sources.id = items.source_id
           WHERE kb_fts MATCH ?
           ORDER BY rank LIMIT ?""",
        (terms, limit),
    ).fetchall()


def detect_tickers(query: str, conn: sqlite3.Connection) -> list[str]:
    """Uppercase tokens that actually exist in the KB count as tickers."""
    candidates = {t for t in TICKER_RE.findall(query) if t not in TICKER_STOPWORDS}
    if not candidates:
        return []
    placeholders = ",".join("?" * len(candidates))
    rows = conn.execute(
        f"SELECT DISTINCT ticker FROM ticker_mentions WHERE ticker IN ({placeholders})",
        list(candidates),
    ).fetchall()
    return [r["ticker"] for r in rows]


def _print_mentions(rows: list[sqlite3.Row]) -> None:
    for r in rows:
        pt = f" PT {r['price_target']:g} {r['price_target_currency'] or ''}".rstrip() if r["price_target"] else ""
        print(f"{r['published_at'][:10]}  {r['ticker']:<6} {r['stance']:<9} {r['sentiment']:<8}{pt}  [{r['channel']}]")
        if r["thesis"]:
            print(f"           {r['thesis']}")


def run_query(config: Config, query_text: str | None, ticker: str | None,
              since_days: int | None, answer: bool) -> None:
    conn = db.connect(config.db_path)
    try:
        context_rows: list[dict] = []

        if ticker:
            rows = ticker_lookup(conn, ticker, since_days)
            _print_mentions(rows)
            context_rows = [dict(r) for r in rows]
        elif query_text:
            for t in detect_tickers(query_text, conn):
                rows = ticker_lookup(conn, t, since_days)
                if rows:
                    print(f"--- {t} mentions ---")
                    _print_mentions(rows)
                    context_rows += [dict(r) for r in rows]
            fts_rows = fts_search(conn, query_text)
            if fts_rows:
                print("--- related content ---")
                for r in fts_rows:
                    print(f"{r['published_at'][:10]}  [{r['channel']}] {r['title']}")
                    print(f"           {r['content'][:200]}")
                context_rows += [dict(r) for r in fts_rows]

        if not context_rows:
            print("No matches in the knowledge base.")
            return

        if answer and query_text:
            _synthesize_answer(config, query_text, context_rows)
    finally:
        conn.close()


def _synthesize_answer(config: Config, question: str, context_rows: list[dict]) -> None:
    import json

    from google import genai
    from google.genai import types

    if not config.gemini_api_key:
        print("\n(--answer requires GEMINI_API_KEY)")
        return
    client = genai.Client(api_key=config.gemini_api_key)
    response = client.models.generate_content(
        model="gemini-3.6-flash",
        contents=f"<records>\n{json.dumps(context_rows, indent=1)}\n</records>\n\nQuestion: {question}",
        config=types.GenerateContentConfig(
            system_instruction=(
                "You answer questions from a personal knowledge base of YouTube finance "
                "video analyses. Base your answer ONLY on the provided records; cite the "
                "video title and date for each claim. Note disagreements between creators. "
                "These are creators' opinions, not verified facts — reflect that framing."
            ),
        ),
    )
    print("\n=== Answer ===")
    print(response.text)
