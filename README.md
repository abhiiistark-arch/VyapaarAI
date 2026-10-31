# VyapaarAI

AI-powered Google Business Profile management.

## Local

```bash
cd frontend
cp .env.example .env.local
# SECRET_KEY + GEMINI_API_KEY
npm install
npm run dev
```

Demo: `owner@rajveerchinese.demo` / `vyapaarai123`

## Vercel

Root Directory = **blank** (repo root).  
Install/Build use `frontend/` via root `vercel.json`.

Env: `SECRET_KEY`, `GEMINI_API_KEY`, `DEMO_MODE=true`

Details: `deploy/VERCEL.md`

## Layout

- `frontend/` — Next.js UI + Node `/api/v1`
- `backend/` — optional Python FastAPI reference
