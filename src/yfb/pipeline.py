"""Pipeline orchestration: poll → transcript → analyze → store → notify.

Every step commits DB state before the next runs, so a crash at any point
resumes cleanly on the next cron tick via the item status state machine.
"""

from __future__ import annotations

import logging
import sqlite3

from google import genai
from google.genai import errors as genai_errors

from . import db, feeds, telegram, transcripts
from .analyze import AnalysisRefused, analyze_video
from .config import Config

log = logging.getLogger(__name__)


def run(config: Config) -> None:
    conn = db.connect(config.db_path)
    try:
        poll_feeds(conn, config)
        process_transcripts(conn, config)
        analyze_pending(conn, config)
        notify_pending(conn, config)
    finally:
        conn.close()


def poll_feeds(conn: sqlite3.Connection, config: Config) -> None:
    for channel in config.channels:
        try:
            new = feeds.poll_channel(conn, channel, config.settings)
            if new:
                log.info("channel %s: %d new video(s)", channel.channel_id, new)
        except Exception:
            log.exception("feed poll failed for %s; continuing", channel.channel_id)


def process_transcripts(conn: sqlite3.Connection, config: Config) -> None:
    for item in db.items_by_status(conn, "new", "pending_transcript"):
        item_id = item["id"]
        try:
            result = transcripts.fetch_transcript(item["external_id"], config)
        except transcripts.PermanentTranscriptError as exc:
            log.info("no transcript for %s (%s)", item["external_id"], exc)
            db.set_status(conn, item_id, "transcript_failed", str(exc))
        except transcripts.TransientTranscriptError as exc:
            attempts = db.bump_transcript_attempts(conn, item_id)
            if attempts >= config.settings.transcript_max_attempts:
                log.warning("giving up on transcript for %s after %d attempts",
                            item["external_id"], attempts)
                db.set_status(conn, item_id, "transcript_failed", str(exc))
            else:
                db.set_status(conn, item_id, "pending_transcript", str(exc))
        else:
            db.store_transcript(conn, item_id, result.text, result.language, result.is_generated)
            # Transcript stored; item stays in a pre-analysis status. We reuse
            # 'new' so analyze_pending picks it up by transcript presence.
            db.set_status(conn, item_id, "new", None)
        conn.commit()


def analyze_pending(conn: sqlite3.Connection, config: Config) -> None:
    if not config.gemini_api_key:
        log.warning("GEMINI_API_KEY not set; skipping analysis")
        return
    client = genai.Client(api_key=config.gemini_api_key)

    for item in db.items_by_status(conn, "new"):
        item_id = item["id"]
        transcript_text = db.get_transcript(conn, item_id)
        if transcript_text is None:
            continue  # still awaiting transcript
        try:
            result = analyze_video(
                client,
                title=item["title"],
                channel_name=item["source_name"] or "",
                published_at=item["published_at"],
                transcript=transcript_text,
            )
        except AnalysisRefused as exc:
            db.set_status(conn, item_id, "failed", f"refused: {exc}")
        except genai_errors.APIError as exc:
            if exc.code == 429 or (exc.code or 0) >= 500:
                # Transient: leave status unchanged; retried next run.
                log.warning("API error for item %d, will retry next run: %s", item_id, exc)
                continue
            db.set_status(conn, item_id, "failed", f"api error {exc.code}: {exc}")
        except ValueError as exc:
            db.set_status(conn, item_id, "failed", str(exc))
        else:
            db.store_analysis(
                conn,
                item_id,
                result.analysis.model_dump(),
                result.model,
                result.input_tokens,
                result.output_tokens,
            )
            db.set_status(conn, item_id, "summarized", None)
        conn.commit()


def notify_pending(conn: sqlite3.Connection, config: Config) -> None:
    if not (config.telegram_bot_token and config.telegram_chat_id):
        log.warning("Telegram secrets not set; skipping notifications")
        return

    # Full summaries.
    for item in db.items_by_status(conn, "summarized"):
        summary = db.get_summary(conn, item["id"])
        if summary is None:
            db.set_status(conn, item["id"], "failed", "summarized but no summary row")
            conn.commit()
            continue
        mentions = [dict(m) for m in db.get_mentions(conn, item["id"])]
        text = telegram.format_message(
            title=item["title"],
            channel_name=item["source_name"] or "",
            published_at=item["published_at"],
            url=item["url"],
            tldr=summary["tldr"],
            mentions=mentions,
            macro_view=summary["macro_view"],
        )
        _send(conn, config, item["id"], text)

    # Metadata-only fallbacks for videos whose transcript never materialized.
    for item in db.items_by_status(conn, "transcript_failed"):
        text = telegram.format_metadata_only(
            title=item["title"],
            channel_name=item["source_name"] or "",
            published_at=item["published_at"],
            url=item["url"],
        )
        _send(conn, config, item["id"], text)


def _send(conn: sqlite3.Connection, config: Config, item_id: int, text: str) -> None:
    try:
        telegram.send_message(config.telegram_bot_token, config.telegram_chat_id, text)
    except Exception:
        # Leave status unchanged; retried next run without re-analyzing.
        log.exception("telegram send failed for item %d", item_id)
    else:
        db.set_status(conn, item_id, "notified", None)
    conn.commit()


def backfill(config: Config, channel_id: str | None, limit: int | None) -> int:
    """Flip 'seen_skipped' items to 'new' so the normal pipeline processes them."""
    conn = db.connect(config.db_path)
    try:
        query = """SELECT items.id FROM items
                   JOIN sources ON sources.id = items.source_id
                   WHERE items.status = 'seen_skipped'"""
        params: list = []
        if channel_id:
            query += " AND sources.external_id = ?"
            params.append(channel_id)
        query += " ORDER BY items.published_at DESC"
        if limit:
            query += " LIMIT ?"
            params.append(limit)
        ids = [row["id"] for row in conn.execute(query, params).fetchall()]
        for item_id in ids:
            db.set_status(conn, item_id, "new", None)
        conn.commit()
        return len(ids)
    finally:
        conn.close()
