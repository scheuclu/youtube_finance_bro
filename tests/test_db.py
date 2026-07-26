from yfb import db


def _setup(tmp_path):
    conn = db.connect(tmp_path / "test.sqlite3")
    source_id, created = db.upsert_source(conn, "youtube_channel", "UCtest", "Test")
    assert created
    item_id = db.insert_item(conn, source_id, "vid1", "Title", "https://u", "2026-07-26T00:00:00Z", "new")
    assert item_id is not None
    return conn, source_id, item_id


def test_insert_item_dedup(tmp_path):
    conn, source_id, _ = _setup(tmp_path)
    dup = db.insert_item(conn, source_id, "vid1", "Title", "https://u", "2026-07-26T00:00:00Z", "new")
    assert dup is None
    assert conn.execute("SELECT COUNT(*) FROM items").fetchone()[0] == 1


def test_status_transitions_and_attempts(tmp_path):
    conn, _, item_id = _setup(tmp_path)
    assert db.bump_transcript_attempts(conn, item_id) == 1
    assert db.bump_transcript_attempts(conn, item_id) == 2
    db.set_status(conn, item_id, "pending_transcript", "IpBlocked")
    row = conn.execute("SELECT * FROM items WHERE id = ?", (item_id,)).fetchone()
    assert row["status"] == "pending_transcript"
    assert row["last_error"] == "IpBlocked"

    items = db.items_by_status(conn, "pending_transcript")
    assert len(items) == 1
    assert items[0]["source_name"] == "Test"


def test_store_analysis_and_fts(tmp_path):
    conn, _, item_id = _setup(tmp_path)
    analysis = {
        "tldr": "NVDA is going up says the bro.",
        "summary_md": "- point one\n- point two",
        "overall_sentiment": "bullish",
        "macro_view": "Fed will cut rates",
        "tickers": [
            {
                "ticker": "nvda",
                "asset_name": "NVIDIA",
                "stance": "buy",
                "sentiment": "bullish",
                "thesis": "Datacenter demand is accelerating.",
                "price_target": 250.0,
                "price_target_currency": "USD",
                "time_horizon": "medium",
                "confidence": "high",
                "quote": "buy the dip",
            }
        ],
    }
    db.store_analysis(conn, item_id, analysis, "gemini-3.6-flash", 1000, 200)

    summary = db.get_summary(conn, item_id)
    assert summary["tldr"].startswith("NVDA")
    mentions = db.get_mentions(conn, item_id)
    assert len(mentions) == 1
    assert mentions[0]["ticker"] == "NVDA"  # normalized to uppercase

    # FTS finds both the summary and the thesis (porter stemming).
    hits = conn.execute("SELECT * FROM kb_fts WHERE kb_fts MATCH ?", ("datacenter",)).fetchall()
    assert len(hits) == 1

    # Re-storing replaces rather than duplicates.
    db.store_analysis(conn, item_id, analysis, "gemini-3.6-flash", 1000, 200)
    assert len(db.get_mentions(conn, item_id)) == 1
    assert conn.execute("SELECT COUNT(*) FROM kb_fts").fetchone()[0] == 2
