# Deploy VyapaarAI on Vercel (frontend + Node API together)

Repo: https://github.com/abhiiistark-arch/VyapaarAI

One Vercel project serves **Next.js UI + `/api/v1/*`** (handlers in `frontend/server/`).

## Critical: Root Directory = `frontend`

If you see **`NEXT_NO_VERSION` / No Next.js version detected**, Vercel is building from the **repo root** (no `next` there). The app lives in **`frontend/`**.

### Fix existing Vercel project

1. Open the project → **Settings** → **General**
2. **Root Directory** → **Edit** → set to `frontend` → **Save**
3. **Settings** → **Build & Development Settings**
   - Framework Preset: **Next.js**
   - Clear any custom **Install Command** / **Build Command** / **Output Directory** overrides (use defaults)
4. **Deployments** → latest → **Redeploy** (or push a new commit)

### New import

1. https://vercel.com/new → import `abhiiistark-arch/VyapaarAI`
2. **Root Directory** = `frontend` (click Edit before deploy)
3. Framework = Next.js (auto)
4. Env (Production + Preview):

| Name | Value | Notes |
|------|--------|--------|
| `SECRET_KEY` | long random string | JWT signing |
| `GEMINI_API_KEY` | your key | server-only; AI features |
| `DEMO_MODE` | `true` | demo login + sample data |
| `USE_LIVE_GOOGLE` | `false` | until GBP OAuth is ready |

Do **not** set `NEXT_PUBLIC_API_URL` (defaults to same-origin `/api/v1`).

5. Deploy

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

## CLI (from frontend)

```bash
cd frontend
npx vercel login
npx vercel --prod
```

When prompted for root, choose / confirm the `frontend` folder.

## Layout

- `frontend/package.json` — has `next` (this is what Vercel must see)
- `frontend/vercel.json` — Next.js + `bom1`
- `frontend/app/api/v1/[...path]/route.ts` — Node API
- root `vercel.json` — regions only (do **not** put `cd frontend` install/build here)
