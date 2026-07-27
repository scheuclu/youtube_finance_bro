"""YouTube RSS feed polling and diffing against the DB."""

from __future__ import annotations

import logging
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import feedparser

from . import db
from .config import Channel, Settings

log = logging.getLogger(__name__)


@dataclass
class FeedEntry:
    video_id: str
    title: str
    url: str
    published_at: datetime  # aware UTC


def parse_feed(xml: str | bytes) -> tuple[str | None, list[FeedEntry]]:
    """Parse a YouTube channel feed. Returns (channel_title, entries)."""
    parsed = feedparser.parse(xml)
    channel_title = parsed.feed.get("title")
    entries: list[FeedEntry] = []
    for e in parsed.entries:
        video_id = e.get("yt_videoid")
        if not video_id:
            continue
        published = e.get("published_parsed")
        if not published:
            continue
        entries.append(
            FeedEntry(
                video_id=video_id,
                title=e.get("title", "(untitled)"),
                url=e.get("link") or f"https://www.youtube.com/watch?v={video_id}",
                published_at=datetime(*published[:6], tzinfo=timezone.utc),
            )
        )
    return channel_title, entries


def fetch_feed(channel: Channel) -> tuple[str | None, list[FeedEntry]]:
    import httpx

    # Best effort at untranslated metadata; YouTube still geolocates by IP, so
    # pin display names in channels.yaml rather than trusting the feed title.
    resp = httpx.get(
        channel.feed_url,
        timeout=30,
        follow_redirects=True,
        headers={"Accept-Language": "en-US,en;q=0.9"},
    )
    resp.raise_for_status()
    return parse_feed(resp.content)


def poll_channel(conn: sqlite3.Connection, channel: Channel, settings: Settings) -> int:
    """Poll one channel's feed and insert unseen videos.

    On the first sight of a channel, existing feed entries are recorded as
    'seen_skipped' so the initial run never triggers a summarization flood.
    Returns the number of items inserted as 'new'.
    """
    channel_title, entries = fetch_feed(channel)
    source_id, created = db.upsert_source(
        conn, "youtube_channel", channel.channel_id, channel.name or channel_title
    )

    cutoff = datetime.now(timezone.utc) - timedelta(days=settings.max_video_age_days)
    new_count = 0
    for entry in entries:
        if created:
            status = "seen_skipped"
        elif entry.published_at < cutoff:
            status = "seen_skipped"
        else:
            status = "new"
        inserted = db.insert_item(
            conn,
            source_id,
            entry.video_id,
            entry.title,
            entry.url,
            entry.published_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
            status,
        )
        if inserted and status == "new":
            new_count += 1
    conn.commit()
    if created:
        log.info("channel %s registered; %d existing videos marked seen_skipped",
                 channel.channel_id, len(entries))
    return new_count
