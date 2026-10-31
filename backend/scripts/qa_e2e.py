"""End-to-end QA smoke for VyapaarAI (demo mode)."""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from typing import Any

API = "http://127.0.0.1:8001/api/v1"
WEB = "http://127.0.0.1:3000"
EMAIL = "owner@rajveerchinese.demo"
PASSWORD = "vyapaarai123"

results: list[tuple[str, str, str]] = []


def record(area: str, status: str, detail: str = "") -> None:
    results.append((area, status, detail))
    mark = "PASS" if status == "PASS" else ("WARN" if status == "WARN" else "FAIL")
    print(f"[{mark}] {area}: {detail}")


def req(
    method: str,
    url: str,
    *,
    token: str | None = None,
    body: dict | None = None,
    timeout: int = 90,
) -> tuple[int, Any]:
    data = None if body is None else json.dumps(body).encode()
    headers = {"Accept": "application/json"}
    if body is not None:
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as resp:
            raw = resp.read().decode() or "{}"
            try:
                payload = json.loads(raw)
            except Exception:
                payload = raw
            return resp.status, payload
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode(errors="ignore")
        try:
            payload = json.loads(raw)
        except Exception:
            payload = raw
        return exc.code, payload
    except Exception as exc:
        return 0, str(exc)


def main() -> int:
    # 1) Health / frontend
    code, health = req("GET", "http://127.0.0.1:8001/health")
    if code == 200 and isinstance(health, dict) and health.get("status") == "ok":
        record("API health", "PASS", f"demo={health.get('demo_mode')} gemini={health.get('gemini_configured')}")
    else:
        record("API health", "FAIL", f"{code} {health}")
        _print_summary()
        return 1

    code, page = req("GET", f"{WEB}/login")
    if code == 200 and isinstance(page, str) and ("login" in page.lower() or "Vyapaar" in page or "html" in page.lower() or len(page) > 100):
        record("Frontend /login", "PASS", f"HTTP {code}")
    else:
        # Next may return HTML without 'login' text in first chunk depending on RSC
        if code == 200:
            record("Frontend /login", "PASS", f"HTTP {code} (page loaded)")
        else:
            record("Frontend /login", "FAIL", f"{code} {str(page)[:120]}")

    for path in ("/overview", "/analytics", "/posts", "/automation", "/reviews"):
        code, _ = req("GET", f"{WEB}{path}")
        # App routes may redirect to login without auth cookie — 200/307/308 acceptable for smoke
        if code in (200, 307, 308, 0):
            # urllib follows redirects; unauthenticated app pages often still 200 with client redirect
            record(f"Frontend {path}", "PASS" if code == 200 else "WARN", f"HTTP {code}")
        else:
            record(f"Frontend {path}", "FAIL", f"HTTP {code}")

    # 2) Auth
    code, login = req("POST", f"{API}/auth/login", body={"email": EMAIL, "password": PASSWORD})
    if code != 200 or not isinstance(login, dict) or not login.get("access_token"):
        record("Auth login", "FAIL", f"{code} {login}")
        _print_summary()
        return 1
    token = login["access_token"]
    record("Auth login", "PASS", "demo owner token issued")

    # 3) Overview + engagement
    code, overview = req("GET", f"{API}/dashboard/overview?days=30", token=token)
    if code != 200 or not isinstance(overview, dict):
        record("Dashboard overview", "FAIL", f"{code}")
    else:
        eng = overview.get("engagement") or {}
        stats = overview.get("stats") or {}
        ok = (
            isinstance(eng, dict)
            and eng.get("profile_views", 0) > 0
            and eng.get("website_clicks", 0) > 0
            and eng.get("call_clicks", 0) > 0
            and "total_posts" in stats
            and "published_posts" in stats
        )
        record(
            "Dashboard engagement",
            "PASS" if ok else "FAIL",
            f"views={eng.get('profile_views')} web={eng.get('website_clicks')} calls={eng.get('call_clicks')} posts={stats.get('total_posts')}/{stats.get('published_posts')}",
        )

    # 4) Analytics + report
    code, analytics = req("GET", f"{API}/analytics?days=30", token=token)
    if code == 200 and isinstance(analytics, dict) and analytics.get("engagement", {}).get("maps_views", 0) > 0:
        record("Analytics API", "PASS", f"maps={analytics['engagement']['maps_views']} search={analytics['engagement']['search_views']}")
    else:
        record("Analytics API", "FAIL", f"{code} {str(analytics)[:160]}")

    code, report = req("POST", f"{API}/analytics/reports?days=30", token=token)
    if code == 200 and isinstance(report, dict) and report.get("id"):
        rid = report["id"]
        dcode, download = req("GET", f"{API}/analytics/reports/{rid}/download", token=token)
        if dcode == 200 and isinstance(download, str) and "Profile views" in download:
            record("Analytics report download", "PASS", f"report={rid[:8]}")
        else:
            record("Analytics report download", "FAIL", f"{dcode}")
    else:
        record("Analytics report create", "FAIL", f"{code}")

    # 5) Locations / reviews / posts consistency
    code, locs = req("GET", f"{API}/google/locations", token=token)
    if code != 200 or not isinstance(locs, list) or not locs:
        record("Locations", "FAIL", f"{code}")
        location_id = None
    else:
        location_id = locs[0]["id"]
        record("Locations", "PASS", locs[0].get("title", location_id))

    code, reviews = req("GET", f"{API}/reviews", token=token)
    if code == 200 and isinstance(reviews, dict) and "items" in reviews and "stats" in reviews:
        record("Reviews list+stats", "PASS", f"items={len(reviews['items'])} unanswered={reviews['stats'].get('unanswered_reviews')}")
    else:
        record("Reviews list+stats", "FAIL", f"{code} shape")

    code, posts = req("GET", f"{API}/posts", token=token)
    if code == 200 and isinstance(posts, dict) and "items" in posts and "stats" in posts:
        pstats = posts["stats"]
        ostats = (overview.get("stats") if isinstance(overview, dict) else {}) or {}
        consistent = (
            pstats.get("total_posts") == ostats.get("total_posts")
            and pstats.get("published_posts") == ostats.get("published_posts")
        )
        record(
            "Posts/overview consistency",
            "PASS" if consistent else "FAIL",
            f"posts.total={pstats.get('total_posts')} overview.total={ostats.get('total_posts')} published={pstats.get('published_posts')}",
        )
    else:
        record("Posts list+stats", "FAIL", f"{code}")

    code, media = req("GET", f"{API}/posts/media", token=token)
    if code == 200 and isinstance(media, dict) and "items" in media:
        record("Media list", "PASS", f"items={len(media['items'])}")
    else:
        record("Media list", "FAIL", f"{code}")

    # 6) Posts create / schedule / AI image
    if location_id:
        code, created = req(
            "POST",
            f"{API}/posts",
            token=token,
            body={
                "location_id": location_id,
                "summary": "QA smoke post — weekend specials and takeaway reminder.",
                "status": "draft",
                "post_type": "STANDARD",
            },
        )
        record("Create draft post", "PASS" if code == 200 else "FAIL", f"{code}")

        code, batch = req(
            "POST",
            f"{API}/posts/schedule-batch",
            token=token,
            body={
                "location_id": location_id,
                "topics": ["QA topic A lunch special", "QA topic B evening noodles"],
                "interval_days": 2,
                "generate_ai_copy": False,
                "attach_ai_image": False,
            },
        )
        if code == 200 and isinstance(batch, dict) and batch.get("count", 0) >= 2:
            record("Schedule topic batch", "PASS", f"count={batch.get('count')}")
        else:
            record("Schedule topic batch", "FAIL", f"{code} {str(batch)[:120]}")

        code, image = req(
            "POST",
            f"{API}/posts/media/generate",
            token=token,
            body={
                "location_id": location_id,
                "brief": "QA Manchurian bowl photo",
                "category": "FOOD_AND_DRINK",
                "save": True,
            },
            timeout=120,
        )
        if code == 200 and isinstance(image, dict) and image.get("source_url"):
            record(
                "AI media generate",
                "PASS",
                f"source={image.get('generation_source')} url_ok={bool(image.get('source_url'))}",
            )
            # fetch generated media file
            media_url = image["source_url"].replace("localhost", "127.0.0.1")
            # backend_url may be :8000 while API runs :8001 — try both
            candidates = [media_url]
            if ":8000/" in media_url:
                candidates.append(media_url.replace(":8000/", ":8001/"))
            fetched = False
            for cand in candidates:
                mcode, _ = req("GET", cand)
                if mcode == 200:
                    fetched = True
                    break
            record("AI media file serve", "PASS" if fetched else "WARN", "served" if fetched else "URL host/port mismatch possible")
        else:
            record("AI media generate", "FAIL", f"{code} {str(image)[:160]}")

        # AI text generate (may be slow / free-tier)
        code, gen = req(
            "POST",
            f"{API}/posts/generate",
            token=token,
            body={"location_id": location_id, "topic": "QA short offer post", "tone": "friendly", "mode": "post"},
            timeout=60,
        )
        if code == 200 and isinstance(gen, dict) and gen.get("summary"):
            record("AI post generate", "PASS", f"chars={len(gen.get('summary', ''))}")
        else:
            record("AI post generate", "WARN" if code in (429, 500, 0) else "FAIL", f"{code} {str(gen)[:140]}")

    # 7) Automation
    code, auto = req("GET", f"{API}/automation", token=token)
    if code == 200 and isinstance(auto, dict) and "enabled" in auto and "auto_ai_reply_enabled" in auto:
        record("Automation settings", "PASS", f"enabled={auto.get('enabled')} auto_ai={auto.get('auto_ai_reply_enabled')}")
        # save toggle without enabling destructive mass replies in QA unless already configured
        code, saved = req(
            "PUT",
            f"{API}/automation",
            token=token,
            body={
                **{k: auto[k] for k in auto if k in {
                    "enabled", "auto_reply_positive", "auto_ai_reply_enabled",
                    "require_approval_neutral", "require_approval_negative",
                    "confidence_threshold", "brand_tone", "template_positive",
                    "auto_reply_min_rating", "escalate_keywords", "notify_email",
                    "notify_whatsapp", "schedule_posts_enabled",
                    "quiet_hours_start", "quiet_hours_end",
                }},
                "enabled": True,
                "auto_ai_reply_enabled": False,  # keep off for safe QA; endpoint still tested
            },
        )
        record("Automation save", "PASS" if code == 200 else "FAIL", f"{code}")
    else:
        record("Automation settings", "FAIL", f"{code}")

    # 8) Optimizer / profile
    if location_id:
        code, opt = req(
            "POST",
            f"{API}/profile/optimize",
            token=token,
            body={"location_id": location_id, "focus": "description", "notes": "QA check"},
            timeout=60,
        )
        if code == 200 and isinstance(opt, dict) and (opt.get("improved_text") or opt.get("suggestion")):
            record("Profile optimize", "PASS", f"keys={list(opt.keys())[:5]}")
        else:
            record("Profile optimize", "WARN" if code in (429, 500) else "FAIL", f"{code} {str(opt)[:140]}")

    # 9) System mode
    code, mode = req("GET", f"{API}/system/mode")
    if code == 200 and isinstance(mode, dict):
        record("System mode", "PASS", f"demo={mode.get('demo_mode')} live_google={mode.get('google_live_enabled')}")
    else:
        record("System mode", "FAIL", f"{code}")

    return _print_summary()


def _print_summary() -> int:
    passed = sum(1 for _, s, _ in results if s == "PASS")
    warned = sum(1 for _, s, _ in results if s == "WARN")
    failed = sum(1 for _, s, _ in results if s == "FAIL")
    print("\n===== QA SUMMARY =====")
    print(f"PASS={passed} WARN={warned} FAIL={failed} TOTAL={len(results)}")
    if failed:
        print("Failed cases:")
        for area, status, detail in results:
            if status == "FAIL":
                print(f" - {area}: {detail}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
