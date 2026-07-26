"""Summarization + structured extraction with Gemini.

One call per video returns both the human-readable summary and structured
ticker/thesis entities, via structured outputs (response_schema + Pydantic).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from google import genai
from google.genai import types

from .models import EXTRACTION_SYSTEM_PROMPT, VideoAnalysis

log = logging.getLogger(__name__)

MODEL = "gemini-3.6-flash"
# Transcripts can be huge for multi-hour streams; cap input defensively.
MAX_TRANSCRIPT_CHARS = 400_000


class AnalysisRefused(Exception):
    """Model/safety system declined the content — do not retry."""


@dataclass
class AnalysisResult:
    analysis: VideoAnalysis
    model: str
    input_tokens: int | None
    output_tokens: int | None


def _generate(client: genai.Client, user_content: str):
    return client.models.generate_content(
        model=MODEL,
        contents=user_content,
        config=types.GenerateContentConfig(
            system_instruction=EXTRACTION_SYSTEM_PROMPT,
            response_mime_type="application/json",
            response_schema=VideoAnalysis,
        ),
    )


def _check_blocked(response) -> None:
    feedback = getattr(response, "prompt_feedback", None)
    if feedback and getattr(feedback, "block_reason", None):
        raise AnalysisRefused(f"prompt blocked: {feedback.block_reason}")
    candidates = getattr(response, "candidates", None) or []
    if candidates and str(getattr(candidates[0], "finish_reason", "")).endswith("SAFETY"):
        raise AnalysisRefused("response blocked by safety filter")


def analyze_video(
    client: genai.Client,
    title: str,
    channel_name: str,
    published_at: str,
    transcript: str,
) -> AnalysisResult:
    if len(transcript) > MAX_TRANSCRIPT_CHARS:
        log.warning("transcript truncated from %d chars", len(transcript))
        transcript = transcript[:MAX_TRANSCRIPT_CHARS] + "\n[transcript truncated]"

    user_content = (
        "<video_metadata>\n"
        f"Title: {title}\n"
        f"Channel: {channel_name}\n"
        f"Published: {published_at}\n"
        "</video_metadata>\n\n"
        f"<transcript>\n{transcript}\n</transcript>"
    )

    response = _generate(client, user_content)
    _check_blocked(response)

    analysis = response.parsed
    if analysis is None:
        # Rare schema/parsing hiccup — retry once before giving up.
        response = _generate(client, user_content)
        _check_blocked(response)
        analysis = response.parsed
        if analysis is None:
            raise ValueError("no parsable structured output from model")

    usage = getattr(response, "usage_metadata", None)
    return AnalysisResult(
        analysis=analysis,
        model=MODEL,
        input_tokens=getattr(usage, "prompt_token_count", None),
        output_tokens=getattr(usage, "candidates_token_count", None),
    )
