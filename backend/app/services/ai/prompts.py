"""Central prompt library for VyapaarAI.

All AI prompts must be business-agnostic. Never hardcode a sample brand.
Business facts come only from the connected/selected location payload.
Rajveer Chinese (or any other brand) may exist only as demo DB seed data —
never inside these prompts.
"""

from __future__ import annotations

from typing import Any


SYSTEM_GUARDRAILS = """
You are VyapaarAI, an AI co-pilot for Google Business Profile (GBP) management.

## Mission
Help any legitimate business improve its Google Business Profile using ONLY the
business facts provided in the request context. Suggestions must be specific to
THAT business — never invent a different brand, city, menu, or industry.

## Hard rules (never break)
1. Never fabricate customer reviews, reviewer names, ratings, or experiences.
2. Never invent awards, certifications, licenses, partnerships, celebrity visits,
   “best in city” claims, or guaranteed Google ranking / map-pack results.
3. Never claim a Google write/publish succeeded unless the backend confirms it.
4. Never copy or reuse details from example businesses. If a field is missing,
   say it is missing and suggest what to collect — do not fill with unrelated content.
5. Stay within Google Business Profile policies and practical character limits.
6. Prefer local SEO that is natural and truthful for the provided category + area.
7. For sensitive / legal / health / safety complaints: escalate to human review;
   do not admit liability or invent compensation promises.
8. Keep tone professional, warm, and brand-safe unless a different tone is requested.
9. If user notes conflict with policy (fake reviews, keyword stuffing, misleading offers),
   refuse that part and explain briefly.
10. Output exactly in the requested format (JSON or plain text). No markdown fences
    unless asked.

## Analysis first
Before writing improvements, silently analyze the provided profile:
- completeness of name, category, address, phone, website, hours, services, attributes, description
- local relevance (city/area cues already present)
- clarity, uniqueness, and policy risk
Then produce recommendations grounded in that analysis.
""".strip()


# Shorter guardrails for latency-sensitive UI actions (review reply, captions).
SYSTEM_GUARDRAILS_FAST = """
You are VyapaarAI for Google Business Profile.
Use ONLY provided business/review facts. Never invent brands, reviews, awards, or ranking claims.
Never claim Google publish succeeded. No liability admissions on complaints.
Keep outputs concise and return the exact requested format.
""".strip()


JSON_HINTS = {
    "optimize": "JSON keys: title, suggestion, improved_text, checklist (array of short actions), ready_to_apply (boolean), analysis_summary",
    "description": "JSON keys: description, keywords (array), notes, analysis_summary",
    "review_reply": "JSON keys: reply, tone, caution, analysis_summary",
    "post": "JSON keys: summary, post_type, cta_type, cta_url_suggestion, media_suggestion (photo|video|none), analysis_summary",
    "photo_caption": "JSON keys: caption, alt_text, hashtags (array), analysis_summary",
    "photo_generate": (
        "JSON keys: image_prompt, negative_prompt, scene_title, primary_subject, "
        "lighting, camera, mood, visual_elements (array), revision_applied (array), "
        "caption, alt_text, hashtags (array), style (string), accent_color (hex), "
        "bg_color (hex), analysis_summary"
    ),
    "video_concept": (
        "JSON keys: title, duration_seconds, script, shot_list (array of strings), "
        "voiceover, thumbnail_prompt, caption, cta_line, analysis_summary"
    ),
}


def business_context(location: Any, meta: dict | None = None) -> str:
    """Build a neutral business context block from a BusinessLocation-like object."""
    meta = meta or {}
    services = meta.get("services") or []
    attributes = meta.get("attributes") or []
    hours = meta.get("hours") or "unknown"

    def _join(values: list) -> str:
        return ", ".join(str(v) for v in values if v) if values else "not provided"

    return f"""
## Connected business context (source of truth)
- Business name: {getattr(location, "title", None) or "unknown"}
- Primary category: {getattr(location, "primary_category", None) or "unknown"}
- Address: {getattr(location, "address", None) or "unknown"}
- Phone: {getattr(location, "phone", None) or "unknown"}
- Website: {getattr(location, "website", None) or "unknown"}
- Hours: {hours}
- Services: {_join(services)}
- Attributes: {_join(attributes)}
- Current description: {getattr(location, "description", None) or "none"}
- Sync status: {getattr(location, "sync_status", None) or "unknown"}

Treat the block above as the only business facts you may use.
""".strip()


def profile_optimize_prompt(
    location: Any,
    *,
    focus: str,
    notes: str = "",
    meta: dict | None = None,
) -> str:
    focus_guide = {
        "description": "Rewrite/improve the GBP business description (<=750 chars), natural local SEO, no keyword stuffing.",
        "website": "Recommend the best website/Maps/CTA URL using provided website/address only.",
        "services": "Improve or structure the services list from existing services; do not invent unrelated services.",
        "categories": "Suggest primary + additional categories relevant to the existing category and services.",
        "posts": "Propose 3 Google Post ideas grounded in this business's real services/location/hours.",
        "attributes": "Suggest GBP attributes that match the provided attributes and business type.",
    }.get(focus, f"Optimize the '{focus}' aspect of this GBP.")

    return f"""
Task: Google Business Profile optimization for ANY connected business.

Optimization focus: {focus}
Focus instructions: {focus_guide}
Extra user notes: {notes or "none"}

{business_context(location, meta)}

Process:
1) Analyze gaps and strengths for this focus.
2) Produce improved_text ready for the user to edit/approve.
3) Provide a short checklist of next actions.
4) Set ready_to_apply=true only if improved_text is safe and grounded in provided facts.

Return JSON with keys:
title, suggestion, improved_text, checklist, ready_to_apply, analysis_summary
""".strip()


def description_prompt(location: Any, *, notes: str = "", meta: dict | None = None) -> str:
    return f"""
Task: Improve the Google Business Profile description for the connected business.

{business_context(location, meta)}

User notes: {notes or "none"}

Rules:
- Max ~750 characters
- Include locality naturally only if address provides it
- Do not invent services not listed
- No fake social proof

Return JSON with keys: description, keywords, notes, analysis_summary
""".strip()


def review_reply_prompt(
    *,
    business_name: str,
    category: str | None,
    tone: str,
    star_rating: int,
    review_text: str | None,
    existing_reply: str | None = None,
) -> str:
    return f"""
Draft a short Google Business Profile owner reply.

Business: {business_name or "this business"}
Category: {category or "unknown"}
Tone: {tone}
Stars: {star_rating}
Review: {review_text or "(no text)"}
Existing reply: {existing_reply or "none"}

Keep under 220 characters. No invented details. No legal admissions. No fake refunds.
JSON keys: reply, tone, caution, analysis_summary
""".strip()


def local_post_prompt(
    location: Any,
    *,
    topic: str = "",
    tone: str = "friendly",
    meta: dict | None = None,
) -> str:
    return f"""
Task: Write a Google Business Profile local post for the connected business.

{business_context(location, meta)}

Topic / brief from user: {topic or "highlight a real service, offer, or update"}
Tone: {tone}

Rules:
- Under 1500 characters
- No misleading discounts or fake urgency
- CTA must match available website/phone when suggesting a URL
- post_type should be one of: STANDARD, OFFER, EVENT (choose best fit)

Return JSON with keys: summary, post_type, cta_type, cta_url_suggestion, analysis_summary
""".strip()


def photo_caption_prompt(
    location: Any,
    *,
    caption_brief: str = "",
    media_category: str = "ADDITIONAL",
    meta: dict | None = None,
) -> str:
    return f"""
Task: Write a truthful caption for a Google Business Profile photo.

{business_context(location, meta)}

Media category: {media_category}
User brief: {caption_brief or "describe the photo in a useful, local, non-spammy way"}

Rules:
- Do not claim the photo shows something unsupported by the brief/business type
- Keep caption concise and useful for customers
- Hashtags optional and sparse (max 5), no keyword stuffing

Return JSON with keys: caption, alt_text, hashtags, analysis_summary
""".strip()


def _split_brief_and_revisions(brief: str) -> tuple[str, str]:
    """Split 'Improvement notes:' blocks so regenerations actually change the visual."""
    text = (brief or "").strip()
    if not text:
        return "", ""
    marker = "Improvement notes:"
    if marker.lower() in text.lower():
        # case-insensitive split
        idx = text.lower().rfind(marker.lower())
        base = text[:idx].strip()
        notes = text[idx + len(marker) :].strip()
        return base, notes
    return text, ""


def photo_generate_prompt(
    location: Any,
    *,
    brief: str = "",
    media_category: str = "ADDITIONAL",
    style: str = "realistic photo",
    meta: dict | None = None,
) -> str:
    user_brief, revision_notes = _split_brief_and_revisions(brief)
    category = getattr(location, "primary_category", None) or "local business"
    return f"""
Task: Design a HIGH-QUALITY photorealistic Google Business Profile marketing photograph plan.
This plan drives a real image model. Vague prompts produce bad images — be specific.

{business_context(location, meta)}

Media category: {media_category}
Requested style: {style}
User creative brief: {user_brief or f"Hero product/service photo that fits a {category}"}
User revision / improvement notes (MUST apply if present): {revision_notes or "none"}

## image_prompt requirements (critical)
Write ONE detailed English prompt (80–160 words) for a photorealistic 1:1 square photo:
- Exact subject (dish / storefront / interior / team action) grounded in THIS business category + brief
- Plating / props / environment details
- Lighting (e.g. soft daylight from left, warm tungsten, outdoor golden hour)
- Camera (e.g. 50mm, f/2.8, shallow depth of field, slight top-down 30°)
- Color mood and texture (steam, gloss, wood grain, etc. when relevant)
- Composition: subject fills ~60% frame, clean background, no clutter
- Explicitly fold in EVERY revision note (brighter, less text, closer crop, spicier look, etc.)
- FORBIDDEN in the photo: watermarks, logos, UI chrome, readable text overlays, fake awards,
  celebrity faces, unrelated brands, stock-photo people holding phones unless brief asks

## negative_prompt
List what the image model must avoid (comma-separated).

## Other fields
- scene_title: max 5 words for poster fallback headline
- primary_subject: one short noun phrase
- lighting, camera, mood: short strings
- visual_elements: 4–8 concrete nouns present in the scene
- revision_applied: list of revision notes you incorporated (empty array if none)
- caption + alt_text for GBP (truthful, no fake claims)
- accent_color + bg_color: hex colors matching food/brand mood
- hashtags: max 5
- style: final style label (prefer "photorealistic food photography" or similar)

Return JSON only with keys:
image_prompt, negative_prompt, scene_title, primary_subject, lighting, camera, mood,
visual_elements, revision_applied, caption, alt_text, hashtags, style, accent_color, bg_color, analysis_summary
""".strip()


def video_concept_prompt(
    location: Any,
    *,
    brief: str = "",
    tone: str = "friendly",
    duration_seconds: int = 20,
    meta: dict | None = None,
) -> str:
    return f"""
Task: Create a short Google Business Profile video concept (script + shots). Full video render may be queued separately.

{business_context(location, meta)}

User brief: {brief or "Showcase the business in a short, trustworthy clip"}
Tone: {tone}
Target duration seconds: {duration_seconds}

Rules:
- Keep claims truthful to provided business context
- shot_list: 3–6 concrete camera shots
- thumbnail_prompt: detailed still-frame prompt for a cover image
- caption: short GBP-ready post text under the video
- No fake urgency or invented discounts

Return JSON with keys: title, duration_seconds, script, shot_list, voiceover, thumbnail_prompt, caption, cta_line, analysis_summary
""".strip()


def local_post_with_media_prompt(
    location: Any,
    *,
    topic: str = "",
    tone: str = "friendly",
    media_mode: str = "photo",
    meta: dict | None = None,
) -> str:
    return f"""
Task: Write a Google Business Profile local post that works WITH attached {media_mode} media.

{business_context(location, meta)}

Topic / brief: {topic or "highlight a real service or update with matching media"}
Tone: {tone}
Preferred media: {media_mode}  (photo | video | none)

Rules:
- Under 1500 characters
- Mention the media naturally only if helpful (do not invent what the media shows)
- media_suggestion must be one of: photo, video, none
- CTA must match available website/phone when suggesting a URL

Return JSON with keys: summary, post_type, cta_type, cta_url_suggestion, media_suggestion, analysis_summary
""".strip()


def assistant_prompt(
    *,
    user_message: str,
    locations_context: str,
) -> str:
    return f"""
Task: Answer the workspace user about their Google Business Profile management.

Selected / available locations:
{locations_context or "No locations selected yet."}

User message:
{user_message}

Rules:
- Be concise and actionable
- Use only the listed locations as business context
- If they ask to publish/update Google data, explain confirmation is required and do not claim it was done
- Offer next steps they can take in VyapaarAI (optimizer, reviews, posts, automation)

Respond in plain text.
""".strip()


def demo_optimize_fallback(location: Any, focus: str, notes: str = "", meta: dict | None = None) -> dict:
    """Generic offline fallback — uses only this location's fields, never a hard-coded brand."""
    meta = meta or {}
    title = getattr(location, "title", None) or "this business"
    category = getattr(location, "primary_category", None) or "your category"
    address = getattr(location, "address", None) or "your area"
    website = getattr(location, "website", None) or ""
    phone = getattr(location, "phone", None) or ""
    description = getattr(location, "description", None) or ""
    services = meta.get("services") or []
    attributes = meta.get("attributes") or []
    hours = meta.get("hours") or ""

    if focus == "website":
        improved = website or (f"Add an official website or Google Maps link for {title}")
        suggestion = "Use a real website/Maps URL already associated with this profile."
        checklist = ["Verify the URL opens on mobile", "Align CTA with Order / Directions / Learn more"]
    elif focus == "services":
        improved = ", ".join(services) if services else f"Add core services for {category}"
        suggestion = "Keep services tied to what this business actually offers."
        checklist = ["Remove services you do not offer", "Keep names short for GBP"]
    elif focus == "categories":
        improved = category
        suggestion = "Primary category should match what customers search for this business."
        checklist = ["Keep primary category accurate", "Add only relevant additional categories"]
    elif focus == "posts":
        service_hint = services[0] if services else category
        improved = (
            f"1) Highlight {service_hint} this week for {title}.\n"
            f"2) Share hours update{f' ({hours})' if hours else ''} and invite visits.\n"
            f"3) Promote a real customer favourite from your current services list."
        )
        suggestion = "Post ideas grounded in this location's existing profile fields."
        checklist = ["Attach a real photo", "Add a matching CTA"]
    elif focus == "attributes":
        improved = ", ".join(attributes) if attributes else "Add attributes that match how customers use this place"
        suggestion = "Attributes should reflect real customer experience."
        checklist = ["Only enable true attributes", "Review seasonally"]
    else:
        if description:
            improved = description
        else:
            bits = [title]
            if category:
                bits.append(f"is a {category}")
            if address:
                bits.append(f"serving customers at {address}")
            if services:
                bits.append("Known for: " + ", ".join(services[:5]))
            if hours:
                bits.append(f"Hours: {hours}")
            if phone:
                bits.append(f"Call: {phone}")
            improved = ". ".join(bits) + "."
        if notes:
            improved = f"{improved} ({notes[:80]})"
        suggestion = "Description draft built only from this business profile's saved fields."
        checklist = ["Stay under 750 characters", "Do not add unverified claims", "Confirm locality spelling"]

    return {
        "title": f"{focus.title()} draft",
        "suggestion": suggestion,
        "improved_text": improved,
        "checklist": checklist,
        "ready_to_apply": True,
        "analysis_summary": f"Fallback draft for {title} using stored profile fields only.",
        "_model_used": "demo-fallback",
        "source": "business_profile",
    }
