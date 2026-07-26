from datetime import datetime, timedelta, timezone

from yfb import db
from yfb.config import Channel, Settings
from yfb.feeds import FeedEntry, parse_feed, poll_channel

FEED_XML = """<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015"
      xmlns:media="http://search.yahoo.com/mrss/"
      xmlns="http://www.w3.org/2005/Atom">
 <title>Test Finance Channel</title>
 <entry>
  <id>yt:video:abc123def45</id>
  <yt:videoId>abc123def45</yt:videoId>
  <yt:channelId>UCtest</yt:channelId>
  <title>Why NVDA Will 10x</title>
  <link rel="alternate" href="https://www.youtube.com/watch?v=abc123def45"/>
  <published>{published1}</published>
  <updated>{published1}</updated>
 </entry>
 <entry>
  <id>yt:video:xyz987wvu65</id>
  <yt:videoId>xyz987wvu65</yt:videoId>
  <yt:channelId>UCtest</yt:channelId>
  <title>Market Crash Incoming?</title>
  <link rel="alternate" href="https://www.youtube.com/watch?v=xyz987wvu65"/>
  <published>{published2}</published>
  <updated>{published2}</updated>
 </entry>
</feed>
"""


def _feed(published1: datetime, published2: datetime) -> str:
    fmt = "%Y-%m-%dT%H:%M:%S+00:00"
    return FEED_XML.format(published1=published1.strftime(fmt), published2=published2.strftime(fmt))


def test_parse_feed():
    now = datetime.now(timezone.utc)
    title, entries = parse_feed(_feed(now, now - timedelta(days=10)))
    assert title == "Test Finance Channel"
    assert len(entries) == 2
    assert entries[0].video_id == "abc123def45"
    assert entries[0].title == "Why NVDA Will 10x"
    assert entries[0].url.endswith("abc123def45")
    assert abs((entries[0].published_at - now).total_seconds()) < 2


def test_poll_channel_first_sight_skips_then_new(tmp_path, monkeypatch):
    conn = db.connect(tmp_path / "test.sqlite3")
    channel = Channel(channel_id="UCtest")
    settings = Settings(max_video_age_days=3)
    now = datetime.now(timezone.utc)

    entries = [
        FeedEntry("vid1", "Video 1", "https://youtu.be/vid1", now),
        FeedEntry("vid2", "Video 2", "https://youtu.be/vid2", now - timedelta(days=10)),
    ]
    monkeypatch.setattr("yfb.feeds.fetch_feed", lambda ch: ("Test Channel", entries))

    # First sight: everything seen_skipped, nothing new.
    assert poll_channel(conn, channel, settings) == 0
    statuses = {r["external_id"]: r["status"] for r in conn.execute("SELECT * FROM items")}
    assert statuses == {"vid1": "seen_skipped", "vid2": "seen_skipped"}

    # Second poll with a fresh recent video: only it becomes 'new';
    # the stale one is skipped by the age cutoff.
    entries.append(FeedEntry("vid3", "Video 3", "https://youtu.be/vid3", now))
    entries.append(FeedEntry("vid4", "Video 4", "https://youtu.be/vid4", now - timedelta(days=10)))
    assert poll_channel(conn, channel, settings) == 1
    statuses = {r["external_id"]: r["status"] for r in conn.execute("SELECT * FROM items")}
    assert statuses["vid3"] == "new"
    assert statuses["vid4"] == "seen_skipped"

    # Idempotent: re-polling inserts nothing.
    assert poll_channel(conn, channel, settings) == 0
    assert conn.execute("SELECT COUNT(*) FROM items").fetchone()[0] == 4
