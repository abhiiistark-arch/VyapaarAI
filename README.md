# VyapaarAI

AI-powered Google Business Profile management for local businesses and agencies.

## What’s running now

- **Next.js UI + Node `/api/v1`** at repo root (`server/` mirrors FastAPI routes)
- **Demo mode** with Rajveer Chinese (Vadjal) sample data
- **Gemini** for copy, replies, posts, photos
- **One Vercel deploy** (root = Next app)

### Demo login

```
email: owner@rajveerchinese.demo
password: vyapaarai123
```

## Local run

```bash
cp .env.example .env.local
# set SECRET_KEY + GEMINI_API_KEY
npm install
npm run dev
```

Open http://localhost:3000

Optional Python API still under `backend/` if you want it separately.

## Vercel

Root Directory must be **blank / `.`** (app is at repo root, not `frontend/`).

Env: `SECRET_KEY`, `GEMINI_API_KEY`, `DEMO_MODE=true`

See `deploy/VERCEL.md` if you hit `NEXT_NO_VERSION`.
