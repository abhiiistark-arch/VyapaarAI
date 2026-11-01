# Deploy Digital Dukan on Vercel

Next.js app = **`frontend/`** folder.

## Solves `NEXT_OUTPUT_DIR_MISSING` / `frontend/.next` not found

**Do not set Output Directory to `frontend/.next`.**  
For Next.js, Output Directory must stay **empty** (Vercel manages `.next` itself).

### Exact dashboard settings

1. **Settings → General → Root Directory**
   - Set to: **`frontend`**
   - Save

2. **Settings → Build & Development Settings** → click Override / reset so these are defaults:

| Setting | Correct value |
|---------|----------------|
| Framework Preset | **Next.js** |
| Build Command | `npm run build` (default) — **not** `cd frontend && …` |
| Install Command | `npm install` (default) — **not** `cd frontend && …` |
| Output Directory | **LEAVE EMPTY** — delete `frontend/.next` if present |

3. Redeploy latest commit

Why it broke before: Root was repo root (or mixed) while Output Directory pointed at `frontend/.next`, but Next wrote `.next` somewhere else / Vercel Next builder ignored that path → **not found**.

## Env

`SECRET_KEY`, `GEMINI_API_KEY`, `DEMO_MODE=true`, `USE_LIVE_GOOGLE=false`

## Demo data (important)

Vercel pe **PostgreSQL connected nahi hai**.  
Dummy Rajveer Chinese data **in-memory seed** se aati hai (har serverless cold start pe).

Login: `owner@rajveerchinese.demo` / `vyapaarai123`

Local Docker Postgres (`docker compose --profile full`) sirf optional Python `backend/` ke liye hai — Next `/api/v1` abhi usko use nahi karta.

## Demo

`owner@rajveerchinese.demo` / `vyapaarai123`
