"""Telegram notification: HTML formatting with length degradation, sending."""

from __future__ import annotations

import logging
import time

import httpx

log = logging.getLogger(__name__)

TELEGRAM_LIMIT = 4096
STANCE_EMOJI = {"buy": "🟢", "sell": "🔴", "hold": "🟡", "watch": "🟡", "mentioned": "⚪️"}


def esc(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _ticker_line(m: dict, full_thesis: bool) -> str:
    emoji = STANCE_EMOJI.get(m["stance"], "⚪️")
    line = f"{emoji} <b>{esc(m['ticker'])}</b> ({esc(m['stance'])}, {esc(m['sentiment'])})"
    if m.get("price_target"):
        currency = m.get("price_target_currency") or ""
        line += f" — PT {m['price_target']:g} {esc(currency)}".rstrip()
    thesis = m.get("thesis")
    if thesis:
        if not full_thesis:
            thesis = thesis.split(". ")[0].rstrip(".") + "."
        line += f"\n   {esc(thesis)}"
    return line


def format_message(
    title: str,
    channel_name: str,
    published_at: str,
    url: str,
    tldr: str,
    mentions: list[dict],
    macro_view: str | None,
) -> str:
    """Build the HTML message, degrading gracefully to stay under 4096 chars.

    Degradation order: drop macro → shorten theses to first sentence →
    cap tickers at 8 → truncate TL;DR. Never splits into multiple messages.
    """

    def build(include_macro: bool, full_thesis: bool, max_tickers: int, tldr_text: str) -> str:
        parts = [
            f"🎥 <b>{esc(title)}</b>",
            f"{esc(channel_name)} · {esc(published_at[:10])}",
            esc(url),
            "",
            f"<b>TL;DR:</b> {esc(tldr_text)}",
        ]
        shown = mentions[:max_tickers]
        if shown:
            parts += ["", "<b>Tickers:</b>"]
            parts += [_ticker_line(m, full_thesis) for m in shown]
            if len(mentions) > max_tickers:
                parts.append(f"…+{len(mentions) - max_tickers} more")
        if include_macro and macro_view:
            parts += ["", f"<b>Macro:</b> {esc(macro_view)}"]
        return "\n".join(parts)

    for include_macro, full_thesis, max_tickers in (
        (True, True, len(mentions) or 1),
        (False, True, len(mentions) or 1),
        (False, False, len(mentions) or 1),
        (False, False, 8),
    ):
        msg = build(include_macro, full_thesis, max_tickers, tldr)
        if len(msg) <= TELEGRAM_LIMIT:
            return msg

    # Last resort: hard-truncate the TL;DR.
    overhead = len(build(False, False, 8, "")) - 0
    budget = max(50, TELEGRAM_LIMIT - overhead - 1)
    return build(False, False, 8, tldr[:budget] + "…")


def format_metadata_only(title: str, channel_name: str, published_at: str, url: str) -> str:
    return (
        f"🎥 <b>{esc(title)}</b>\n"
        f"{esc(channel_name)} · {esc(published_at[:10])}\n"
        f"{esc(url)}\n\n"
        "⚠️ Transcript unavailable — no summary."
    )


def send_message(bot_token: str, chat_id: str, text: str, max_attempts: int = 3) -> None:
    api_url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": False,
    }
    for _ in range(max_attempts):
        resp = httpx.post(api_url, json=payload, timeout=30)
        if resp.status_code == 200:
            return
        if resp.status_code == 429:
            retry_after = int(resp.json().get("parameters", {}).get("retry_after", 5))
            log.warning("telegram rate limited; sleeping %ds", retry_after)
            time.sleep(retry_after + 1)
            continue
        raise RuntimeError(f"telegram sendMessage failed: {resp.status_code} {resp.text[:200]}")
    raise RuntimeError("telegram sendMessage failed after retries (rate limited)")
