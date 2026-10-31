from __future__ import annotations

import json
from typing import Any

from app.core.config import get_settings
from app.services.ai.prompts import SYSTEM_GUARDRAILS, SYSTEM_GUARDRAILS_FAST


FALLBACK_MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-flash-lite-latest",
    "gemini-3.1-flash-lite",
    "gemini-3.8-flash",
    "gemini-3.5-flash",
]


class GeminiError(RuntimeError):
    pass


def _client():
    settings = get_settings()
    if not settings.gemini_api_key:
        raise GeminiError("GEMINI_API_KEY is not configured")
    from google import genai
    from google.genai import types

    # 45s hard timeout — free-tier Gemini can stall without this.
    return (
        genai.Client(
            api_key=settings.gemini_api_key,
            http_options=types.HttpOptions(timeout=45_000),
        ),
        settings,
    )


def _model_chain(*, fast: bool = True) -> list[str]:
    settings = get_settings()
    preferred = settings.gemini_fast_model if fast else settings.gemini_model
    chain = [preferred, settings.gemini_model, *FALLBACK_MODELS]
    ordered: list[str] = []
    seen: set[str] = set()
    for model in chain:
        if model and model not in seen:
            seen.add(model)
            ordered.append(model)
    return ordered


def generate_json(prompt: str, schema_hint: str = "", *, fast: bool = True) -> dict[str, Any]:
    from google.genai import types

    client, _settings = _client()
    guardrails = SYSTEM_GUARDRAILS_FAST if fast else SYSTEM_GUARDRAILS
    full_prompt = f"{guardrails}\n\n{schema_hint}\n\n{prompt}\nReturn valid JSON only."
    # Photo/plan prompts need more room for detailed image_prompt fields.
    max_tokens = 512 if fast else 1200
    temperature = 0.3 if fast else 0.45
    errors: list[str] = []
    for model in _model_chain(fast=fast):
        try:
            response = client.models.generate_content(
                model=model,
                contents=full_prompt,
                config=types.GenerateContentConfig(
                    temperature=temperature,
                    max_output_tokens=max_tokens,
                    response_mime_type="application/json",
                ),
            )
            data = json.loads(response.text or "{}")
            data["_model_used"] = model
            return data
        except Exception as exc:
            errors.append(f"{model}: {exc}")
            continue
    raise GeminiError(
        "Gemini timed out or failed (free tier can be slow/busy). Try again. "
        + " | ".join(errors[:2])
    )


def generate_text(prompt: str, *, fast: bool = True) -> str:
    from google.genai import types

    client, _settings = _client()
    guardrails = SYSTEM_GUARDRAILS_FAST if fast else SYSTEM_GUARDRAILS
    errors: list[str] = []
    for model in _model_chain(fast=fast):
        try:
            response = client.models.generate_content(
                model=model,
                contents=f"{guardrails}\n\n{prompt}",
                config=types.GenerateContentConfig(
                    temperature=0.3,
                    max_output_tokens=700,
                ),
            )
            return (response.text or "").strip()
        except Exception as exc:
            errors.append(f"{model}: {exc}")
            continue
    raise GeminiError(
        "Gemini timed out or failed (free tier can be slow/busy). Try again. "
        + " | ".join(errors[:2])
    )
