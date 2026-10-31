# Deploy VyapaarAI on Vercel

Repo: https://github.com/abhiiistark-arch/VyapaarAI

Next.js app is in **`frontend/`**. Root `vercel.json` runs:

- Install: `cd frontend && npm install`
- Build: `cd frontend && npm run build`
- Output: `frontend/.next`

## Vercel project settings (must match)

**Settings → General → Root Directory:** leave **empty** (repo root), not `frontend`.

**Settings → Build & Development:**

| Setting | Value |
|---------|--------|
| Framework | Next.js |
| Install Command | `cd frontend && npm install` |
| Build Command | `cd frontend && npm run build` |
| Output Directory | `frontend/.next` |

If you previously changed Root Directory to `frontend`, **clear it back to blank** or builds look for `frontend/frontend/.next` and fail.

## Env vars

| Name | Value |
|------|--------|
| `SECRET_KEY` | long random string |
| `GEMINI_API_KEY` | your key |
| `DEMO_MODE` | `true` |
| `USE_LIVE_GOOGLE` | `false` |

Do not set `NEXT_PUBLIC_API_URL`.

## Demo login

`owner@rajveerchinese.demo` / `vyapaarai123`

## Local

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```
