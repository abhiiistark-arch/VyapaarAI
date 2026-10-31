"""AI marketing image generation with stronger prompts + smarter fallback.

1) Plan via Gemini JSON (photorealistic prompt + revision notes applied)
2) Render via Gemini image models when quota allows
3) Else rich SVG marketing visual that still reflects subject + revision notes
"""

from __future__ import annotations

import base64
import html
import re
import uuid
from pathlib import Path
from typing import Any

from app.core.config import get_settings
from app.services.ai.gemini import GeminiError, generate_json
from app.services.ai.prompts import JSON_HINTS, _split_brief_and_revisions, photo_generate_prompt

IMAGE_MODELS = [
    "gemini-2.5-flash-image",
    "gemini-3.1-flash-image",
    "gemini-3.1-flash-lite-image",
    "gemini-3-pro-image-preview",
]


def _media_root() -> Path:
    root = Path(__file__).resolve().parents[3] / "media" / "generated"
    root.mkdir(parents=True, exist_ok=True)
    return root


def _slug(text: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9]+", "-", (text or "asset").lower()).strip("-")
    return cleaned[:40] or "asset"


def _hex(color: str | None, fallback: str) -> str:
    if color and re.match(r"^#[0-9A-Fa-f]{6}$", color):
        return color
    return fallback


def _wrap_lines(text: str, width: int = 42) -> list[str]:
    words = (text or "").split()
    lines: list[str] = []
    current = ""
    for word in words:
        trial = f"{current} {word}".strip()
        if len(trial) <= width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines[:4] or ["Fresh from the kitchen"]


def _build_render_prompt(plan: dict[str, Any], *, revision_notes: str) -> str:
    image_prompt = (plan.get("image_prompt") or "").strip()
    negative = (plan.get("negative_prompt") or "").strip()
    lighting = plan.get("lighting") or "soft natural daylight"
    camera = plan.get("camera") or "50mm lens, f/2.8, shallow depth of field"
    subject = plan.get("primary_subject") or "hero product"
    mood = plan.get("mood") or "warm and appetizing"
    elements = plan.get("visual_elements") or []
    if isinstance(elements, list):
        elements_txt = ", ".join(str(x) for x in elements[:8])
    else:
        elements_txt = str(elements)

    revision_block = ""
    if revision_notes:
        revision_block = (
            f"\nMANDATORY REVISIONS (change the image accordingly — do not ignore):\n"
            f"{revision_notes}\n"
        )

    return f"""
Create ONE photorealistic square (1:1, 1024x1024) marketing photograph for a Google Business Profile.
Output an IMAGE only (no caption burn-in).

SCENE BRIEF:
{image_prompt}

Primary subject: {subject}
Lighting: {lighting}
Camera: {camera}
Mood: {mood}
Must include visual elements: {elements_txt or "natural props matching the subject"}
{revision_block}
HARD RULES:
- Photorealistic photography, not illustration, not cartoon, not 3D render look
- No watermarks, logos, UI, readable text, or typography overlays
- No fake awards or unrelated brands
- Clean composition, appetizing / welcoming, professional local-business quality
- Avoid: {negative or "blurry, low-res, watermark, text overlay, deformed hands, extra limbs, logo"}
""".strip()


def _svg_poster(
    *,
    business_name: str,
    scene_title: str,
    caption: str,
    accent: str = "#C45C26",
    bg: str = "#FFF8F1",
    category: str = "",
    primary_subject: str = "",
    visual_elements: list[str] | None = None,
    revision_notes: str = "",
    mood: str = "",
) -> bytes:
    accent = _hex(accent, "#C45C26")
    bg = _hex(bg, "#FFF8F1")
    title = html.escape((scene_title or primary_subject or "Fresh update")[:48])
    brand = html.escape((business_name or "Business")[:40])
    cat = html.escape((category or "")[:36])
    subject = html.escape((primary_subject or title)[:40])
    mood_safe = html.escape((mood or "Warm · inviting")[:40])
    caption_lines = [_wrap_lines(caption or primary_subject or scene_title)]
    caption_lines = caption_lines[0]
    elements = [str(x) for x in (visual_elements or []) if x][:6]
    if not elements and revision_notes:
        elements = [w.strip() for w in re.split(r"[,;/]| and ", revision_notes) if w.strip()][:5]
    chips = elements or ["Fresh", "Local", "Made to order"]

    chip_svg = []
    x = 120
    y = 700
    for i, chip in enumerate(chips):
        label = html.escape(chip[:18])
        w = max(90, 12 * len(chip) + 36)
        if x + w > 960:
            x = 120
            y += 52
        chip_svg.append(
            f'<rect x="{x}" y="{y}" width="{w}" height="40" rx="20" fill="{accent}" opacity="0.14"/>'
            f'<text x="{x + 18}" y="{y + 26}" font-family="Arial, sans-serif" font-size="16" fill="#1F1A17">{label}</text>'
        )
        x += w + 12

    caption_svg = []
    cy = 560
    for line in caption_lines:
        caption_svg.append(
            f'<text x="120" y="{cy}" font-family="Arial, sans-serif" font-size="26" fill="#4A403A">{html.escape(line)}</text>'
        )
        cy += 34

    rev = html.escape((revision_notes or "")[:70])
    rev_line = (
        f'<text x="120" y="920" font-family="Arial, sans-serif" font-size="16" fill="#6B5E55">Updated: {rev}</text>'
        if revision_notes
        else ""
    )

    # Simple "hero plate" / storefront shapes so fallback feels less empty.
    hero = f"""
  <ellipse cx="780" cy="430" rx="170" ry="48" fill="{accent}" opacity="0.18"/>
  <circle cx="780" cy="360" r="120" fill="{accent}" opacity="0.22"/>
  <circle cx="780" cy="360" r="78" fill="#FFFFFF" opacity="0.85"/>
  <circle cx="780" cy="360" r="46" fill="{accent}" opacity="0.55"/>
  <text x="780" y="368" text-anchor="middle" font-family="Georgia, serif" font-size="18" fill="#1F1A17">{subject[:16]}</text>
"""

    svg = f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="{bg}"/>
      <stop offset="55%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="{accent}" stop-opacity="0.28"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1080" fill="url(#bg)"/>
  <circle cx="120" cy="980" r="240" fill="{accent}" opacity="0.10"/>
  <circle cx="980" cy="80" r="180" fill="{accent}" opacity="0.12"/>
  <rect x="64" y="64" width="952" height="952" rx="40" fill="#ffffff" opacity="0.78"/>
  <text x="120" y="170" font-family="Georgia, serif" font-size="38" fill="#1F1A17">{brand}</text>
  <text x="120" y="214" font-family="Arial, sans-serif" font-size="20" fill="#6B5E55">{cat} · {mood_safe}</text>
  <text x="120" y="320" font-family="Georgia, serif" font-size="58" fill="#1F1A17">{title}</text>
  <text x="120" y="380" font-family="Arial, sans-serif" font-size="24" fill="#4A403A">Featuring: {subject}</text>
  {"".join(caption_svg)}
  {"".join(chip_svg)}
  {hero}
  {rev_line}
  <text x="120" y="980" font-family="Arial, sans-serif" font-size="18" fill="#8A7B71">VyapaarAI · GBP marketing visual</text>
</svg>
"""
    return svg.encode("utf-8")


def _try_gemini_image(prompt: str) -> tuple[bytes, str] | None:
    settings = get_settings()
    if not settings.gemini_api_key:
        return None
    try:
        from google import genai
        from google.genai import types
    except Exception:
        return None

    # Longer timeout for image models
    try:
        client = genai.Client(
            api_key=settings.gemini_api_key,
            http_options=types.HttpOptions(timeout=90_000),
        )
    except Exception:
        client = genai.Client(api_key=settings.gemini_api_key)

    for model in IMAGE_MODELS:
        try:
            response = client.models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.7,
                    response_modalities=["TEXT", "IMAGE"],
                ),
            )
            parts = getattr(response.candidates[0].content, "parts", []) if response.candidates else []
            for part in parts:
                inline = getattr(part, "inline_data", None)
                if inline and getattr(inline, "data", None):
                    data = inline.data
                    if isinstance(data, str):
                        data = base64.b64decode(data)
                    mime = getattr(inline, "mime_type", None) or "image/png"
                    return data, mime
        except Exception:
            continue
    return None


def _fallback_plan(location: Any, brief: str, style: str, revision_notes: str) -> dict[str, Any]:
    title = getattr(location, "title", None) or "Business"
    category = getattr(location, "primary_category", None) or "local business"
    base, _ = _split_brief_and_revisions(brief)
    subject = (base or f"{category} highlight")[:60]
    return {
        "image_prompt": (
            f"Photorealistic {style} of {subject} for {title}, a {category}. "
            f"Soft natural window light, 50mm lens, shallow depth of field, clean background, "
            f"appetizing textures, square composition. "
            f"Apply revisions: {revision_notes or 'none'}."
        ),
        "negative_prompt": "watermark, text overlay, logo, blurry, low quality, cartoon, deformed",
        "scene_title": subject[:40],
        "primary_subject": subject,
        "lighting": "soft natural daylight",
        "camera": "50mm, f/2.8",
        "mood": "warm and inviting",
        "visual_elements": [w for w in re.findall(r"[A-Za-z]{4,}", subject)][:5] or ["fresh", "local"],
        "revision_applied": [revision_notes] if revision_notes else [],
        "caption": f"{subject} — visit {title}.",
        "alt_text": f"{subject} at {title}",
        "hashtags": [],
        "style": style,
        "accent_color": "#C45C26",
        "bg_color": "#FFF8F1",
        "analysis_summary": "Local fallback plan used after JSON model failure.",
        "_model_used": "fallback-plan",
    }


def generate_marketing_image(
    location: Any,
    *,
    brief: str = "",
    media_category: str = "ADDITIONAL",
    style: str = "photorealistic food photography",
    meta: dict | None = None,
) -> dict[str, Any]:
    user_brief, revision_notes = _split_brief_and_revisions(brief)
    prompt = photo_generate_prompt(
        location,
        brief=brief,
        media_category=media_category,
        style=style or "photorealistic food photography",
        meta=meta,
    )
    try:
        # Prefer higher-quality planning (not lite-fast) so revisions land in image_prompt.
        plan = generate_json(prompt, JSON_HINTS["photo_generate"], fast=False)
    except GeminiError:
        plan = _fallback_plan(location, brief, style, revision_notes)

    # Ensure revision notes are visible even if the model omitted revision_applied.
    if revision_notes:
        applied = plan.get("revision_applied") or []
        if not applied:
            plan["revision_applied"] = [revision_notes]
        # Reinforce notes into image_prompt if model ignored them.
        ip = plan.get("image_prompt") or ""
        if revision_notes.lower() not in ip.lower():
            plan["image_prompt"] = f"{ip}\nAlso apply these changes: {revision_notes}".strip()

    render_prompt = _build_render_prompt(plan, revision_notes=revision_notes)
    rendered = _try_gemini_image(render_prompt)
    backend = get_settings().backend_url.rstrip("/")
    # Prefer public API host used by frontend when backend_url still points at :8000
    file_id = uuid.uuid4().hex[:12]
    stem = _slug(f"{getattr(location, 'title', 'biz')}-{plan.get('scene_title') or plan.get('primary_subject') or 'visual'}")

    if rendered:
        raw, mime = rendered
        ext = "png" if "png" in mime else "jpg"
        filename = f"{stem}-{file_id}.{ext}"
        path = _media_root() / filename
        path.write_bytes(raw)
        source = "gemini_image"
        note = "Photorealistic AI image generated."
        if revision_notes:
            note = "Photorealistic AI image regenerated with your improvement notes."
    else:
        elements = plan.get("visual_elements") if isinstance(plan.get("visual_elements"), list) else []
        raw = _svg_poster(
            business_name=getattr(location, "title", None) or "Business",
            scene_title=str(plan.get("scene_title") or "Fresh update"),
            caption=str(plan.get("caption") or user_brief or ""),
            accent=str(plan.get("accent_color") or "#C45C26"),
            bg=str(plan.get("bg_color") or "#FFF8F1"),
            category=getattr(location, "primary_category", None) or "",
            primary_subject=str(plan.get("primary_subject") or ""),
            visual_elements=elements,
            revision_notes=revision_notes,
            mood=str(plan.get("mood") or ""),
        )
        filename = f"{stem}-{file_id}.svg"
        path = _media_root() / filename
        path.write_bytes(raw)
        source = "svg_poster_fallback"
        note = (
            "Image-model quota busy — generated an improved branded visual that still applies your notes. "
            "Try again later for photorealistic Gemini images."
        )

    public_url = f"{backend}/media/generated/{filename}"
    return {
        "source_url": public_url,
        "caption": plan.get("caption") or "",
        "alt_text": plan.get("alt_text") or "",
        "hashtags": plan.get("hashtags") or [],
        "image_prompt": plan.get("image_prompt"),
        "render_prompt": render_prompt,
        "scene_title": plan.get("scene_title"),
        "primary_subject": plan.get("primary_subject"),
        "revision_applied": plan.get("revision_applied") or ([] if not revision_notes else [revision_notes]),
        "style": plan.get("style") or style,
        "generation_source": source,
        "analysis_summary": plan.get("analysis_summary"),
        "note": note,
        "_model_used": plan.get("_model_used"),
    }
