# Deploy VyapaarAI on Vercel

Repo: https://github.com/abhiiistark-arch/VyapaarAI

Next.js + `/api/v1` Node API live at the **repository root** (`package.json` has `next`).

## Fix `NEXT_NO_VERSION` (important)

If Root Directory was previously set to `frontend`, **clear it**:

1. Vercel → Project → **Settings → General → Root Directory**
2. Set to **empty / `.`** (repository root) — **not** `frontend`
3. **Build & Development Settings**: Framework = **Next.js**, clear custom Install/Build/Output overrides
4. **Redeploy**

## New project

1. Import `abhiiistark-arch/VyapaarAI`
2. Root Directory = **leave blank** (repo root)
3. Framework = Next.js
4. Env:

| Name | Value |
|------|--------|
| `SECRET_KEY` | long random string |
| `GEMINI_API_KEY` | your Gemini key |
| `DEMO_MODE` | `true` |
| `USE_LIVE_GOOGLE` | `false` |

Do not set `NEXT_PUBLIC_API_URL` (defaults to `/api/v1`).

## Demo login

- `owner@rajveerchinese.demo` / `vyapaarai123`

## Local

```bash
# repo root
cp .env.example .env.local
npm install
npm run dev
```
