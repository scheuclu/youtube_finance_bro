from yfb.telegram import TELEGRAM_LIMIT, esc, format_message, format_metadata_only


def _mention(ticker="NVDA", thesis="Datacenter demand is accelerating. Margins keep expanding. Guidance was raised."):
    return {
        "ticker": ticker,
        "stance": "buy",
        "sentiment": "bullish",
        "thesis": thesis,
        "price_target": 250.0,
        "price_target_currency": "USD",
    }


def test_escaping():
    assert esc("<b>AT&T</b>") == "&lt;b&gt;AT&amp;T&lt;/b&gt;"


def test_basic_message():
    msg = format_message(
        title="Why NVDA <rockets>",
        channel_name="Finance & Bro",
        published_at="2026-07-26T10:00:00Z",
        url="https://youtu.be/abc",
        tldr="NVDA to the moon.",
        mentions=[_mention()],
        macro_view="Fed cuts coming",
    )
    assert len(msg) <= TELEGRAM_LIMIT
    assert "&lt;rockets&gt;" in msg
    assert "Finance &amp; Bro" in msg
    assert "🟢 <b>NVDA</b>" in msg
    assert "PT 250 USD" in msg
    assert "Macro:" in msg


def test_degradation_stays_under_limit():
    # Pathological: 40 tickers with very long theses and a huge macro view.
    mentions = [_mention(ticker=f"TK{i:02d}", thesis="Very long thesis sentence. " * 40) for i in range(40)]
    msg = format_message(
        title="Mega video " * 20,
        channel_name="Chan",
        published_at="2026-07-26T10:00:00Z",
        url="https://youtu.be/abc",
        tldr="TLDR sentence. " * 100,
        mentions=mentions,
        macro_view="Macro " * 500,
    )
    assert len(msg) <= TELEGRAM_LIMIT
    assert "+32 more" in msg  # capped at 8 of 40


def test_metadata_only():
    msg = format_metadata_only("T", "C", "2026-07-26T10:00:00Z", "https://u")
    assert "Transcript unavailable" in msg
    assert len(msg) <= TELEGRAM_LIMIT
