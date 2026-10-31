# Deploy VyapaarAI on Vercel (frontend + Node API together)

Repo: https://github.com/abhiiistark-arch/VyapaarAI

One Vercel project serves **Next.js UI + `/api/v1/*` Node routes** (FastAPI-shaped handlers under `frontend/server/`).

Python `backend/` remains as reference / optional self-host; production path is Node inside Next.

## Fast path (GitHub → Vercel)

1. Open https://vercel.com/new
2. Import `abhiiistark-arch/VyapaarAI`
3. Set **Root Directory** = `frontend`
4. Framework = Next.js (auto)
5. Environment variables (Production + Preview):

| Name | Value | Notes |
|------|--------|--------|
| `SECRET_KEY` | long random string | JWT signing |
| `GEMINI_API_KEY` | your key | server-only; AI features |
| `DEMO_MODE` | `true` | demo login + sample data |
| `USE_LIVE_GOOGLE` | `false` | until GBP OAuth is ready |

Do **not** set `NEXT_PUBLIC_API_URL` unless the API is on another host. Default is same-origin `/api/v1`.

6. Deploy → `https://your-app.vercel.app`

## Demo login

- Email: `owner@rajveerchinese.demo`
- Password: `vyapaarai123`

## Local

```bash
cd frontend
cp .env.example .env.local
# add GEMINI_API_KEY + SECRET_KEY
npm install
npm run dev
```

Open http://localhost:3000 — API is at http://localhost:3000/api/v1/...

## CLI

```bash
cd frontend
npx vercel login
npx vercel --prod
```

## Layout

- `frontend/app/api/v1/[...path]/route.ts` — catch-all → Node dispatcher
- `frontend/server/` — config, auth, in-memory demo store, Gemini, route handlers (mirrors FastAPI `/api/v1`)
- `frontend/vercel.json` — Next framework, `bom1`
- root `vercel.json` — monorepo helper if Root Directory is unset
