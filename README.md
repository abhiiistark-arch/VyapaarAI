# VyapaarAI

AI-powered Google Business Profile management for local businesses and agencies.

## What’s running now

- **Next.js UI + Node `/api/v1`** (FastAPI-shaped routes under `frontend/server/`)
- **Demo mode** with **Rajveer Chinese (Vadjal, Satara)** sample data
- **Gemini** for descriptions, review drafts, posts, photos, assistant
- **One Vercel deploy** for UI + API together
- Python `backend/` kept as reference / optional self-host

### Demo login

```
email: owner@rajveerchinese.demo
password: vyapaarai123
```

## Google APIs later (no rewrite)

While GBP access is pending:

```
DEMO_MODE=true
USE_LIVE_GOOGLE=false
```

When Google approves your project, add OAuth secrets and flip live flags (see `deploy/VERCEL.md`).

## Local run (recommended)

```bash
cd frontend
cp .env.example .env.local
# set SECRET_KEY + GEMINI_API_KEY
npm install
npm run dev
```

Open http://localhost:3000 — API is same-origin at `/api/v1/...`

## Optional Python backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

Then point frontend with `NEXT_PUBLIC_API_URL=http://localhost:8001/api/v1`.

## Vercel (UI + API together)

1. Import repo → **Root Directory** = `frontend`
2. Env: `SECRET_KEY`, `GEMINI_API_KEY`, `DEMO_MODE=true`
3. Do **not** set `NEXT_PUBLIC_API_URL` (defaults to `/api/v1`)

Details: `deploy/VERCEL.md`

## Health

`GET /api/v1/system/mode` shows demo vs live Google status and whether Gemini is configured.
