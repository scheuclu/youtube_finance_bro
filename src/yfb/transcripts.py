"""Transcript fetching with IP-block mitigation.

YouTube frequently blocks caption requests from datacenter IPs (GitHub
Actions runners). Strategy:
  1. Classify errors: permanent (no captions exist) vs transient (blocked).
  2. In-run: 2 attempts with jittered backoff.
  3. Cross-run: caller marks the item 'pending_transcript'; each cron tick
     runs on a fresh runner (usually a fresh IP).
  4. Optional Webshare residential proxy via secrets — the reliable fix if
     blocking proves persistent.
"""

from __future__ import annotations

import logging
import random
import time
from dataclasses import dataclass

from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    CouldNotRetrieveTranscript,
    NoTranscriptFound,
    TranscriptsDisabled,
    VideoUnavailable,
)

from .config import Config

log = logging.getLogger(__name__)

PREFERRED_LANGUAGES = ["en", "en-US", "en-GB", "de"]


@dataclass
class TranscriptResult:
    text: str
    language: str | None
    is_generated: bool | None


class PermanentTranscriptError(Exception):
    """No transcript will ever be available (disabled/none/video gone)."""


class TransientTranscriptError(Exception):
    """Worth retrying on a later run (IP block, network, rate limit)."""


def _build_api(config: Config) -> YouTubeTranscriptApi:
    if config.webshare_proxy_username and config.webshare_proxy_password:
        from youtube_transcript_api.proxies import WebshareProxyConfig

        return YouTubeTranscriptApi(
            proxy_config=WebshareProxyConfig(
                proxy_username=config.webshare_proxy_username,
                proxy_password=config.webshare_proxy_password,
            )
        )
    return YouTubeTranscriptApi()


def fetch_transcript(video_id: str, config: Config, attempts: int = 2) -> TranscriptResult:
    """Fetch captions for a video.

    Raises PermanentTranscriptError or TransientTranscriptError.
    """
    api = _build_api(config)
    last_exc: Exception | None = None
    for attempt in range(attempts):
        if attempt:
            time.sleep(20 + random.uniform(0, 20))
        try:
            fetched = api.fetch(video_id, languages=PREFERRED_LANGUAGES)
            text = " ".join(snippet.text for snippet in fetched).strip()
            if not text:
                raise PermanentTranscriptError("transcript empty")
            return TranscriptResult(
                text=text,
                language=getattr(fetched, "language_code", None),
                is_generated=getattr(fetched, "is_generated", None),
            )
        except PermanentTranscriptError:
            raise
        except (TranscriptsDisabled, NoTranscriptFound, VideoUnavailable) as exc:
            raise PermanentTranscriptError(str(exc) or type(exc).__name__) from exc
        except (CouldNotRetrieveTranscript, Exception) as exc:  # noqa: BLE001
            # IpBlocked / RequestBlocked / network errors — all retryable.
            last_exc = exc
            log.warning("transcript fetch attempt %d failed for %s: %s",
                        attempt + 1, video_id, exc)
    raise TransientTranscriptError(str(last_exc) or type(last_exc).__name__) from last_exc
