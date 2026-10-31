# Deploy VyapaarAI frontend on Vercel (free)

Vercel hosts the **Next.js frontend only**.  
FastAPI backend must run separately (Railway / Render / VPS / Docker).

## Why not full-stack on Vercel free?
- Next.js → perfect for Vercel
- FastAPI long-running API + SQLite/workers → not a good fit for Vercel serverless free tier

## 1) Deploy backend first
Example (any host):

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Public URL example: `https://api.yourdomain.com`

## 2) Frontend env on Vercel
In Vercel Project → Settings → Environment Variables:

```
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api/v1
```

## 3) Vercel CLI commands

```bash
npm i -g vercel

# from repo root OR frontend folder
cd frontend
vercel login
vercel          # preview deploy
vercel --prod   # production deploy
```

Or connect the GitHub repo in Vercel dashboard:
- Root Directory: `frontend`
- Framework Preset: Next.js
- Build Command: `npm run build`
- Install Command: `npm install`
- Output: default Next.js

## 4) Files
- `frontend/vercel.json` — frontend project config
- root `vercel.json` — optional if deploying from monorepo root (set Root Directory to `frontend` in dashboard)

## Note on `.toml`
Vercel’s native project config is **`vercel.json`** (not `.toml`).  
If you use Railway/Render for API, those often use `railway.toml` / `render.yaml` separately.
