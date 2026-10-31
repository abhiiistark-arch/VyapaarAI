# Deploy VyapaarAI frontend on Vercel (free)

Repo: https://github.com/abhiiistark-arch/VyapaarAI

Vercel hosts the **Next.js frontend only**.  
FastAPI backend must run separately (Railway / Render / VPS / Docker).

**Never put** `GEMINI_API_KEY`, Google secrets, or `SECRET_KEY` in Vercel frontend env.  
Frontend only needs the public API base URL.

## Fast path (GitHub → Vercel)

1. Open https://vercel.com/new
2. Import `abhiiistark-arch/VyapaarAI`
3. Set **Root Directory** = `frontend`
4. Framework = Next.js (auto)
5. Environment Variable (Production + Preview):

```
NEXT_PUBLIC_API_URL=https://YOUR-PUBLIC-API-HOST/api/v1
```

6. Deploy → you get a public URL like `https://vyapaarai-xxxx.vercel.app`

## Backend (required for login / demo data)

```bash
cd backend
cp .env.example .env
# fill GEMINI_API_KEY + SECRET_KEY locally / on the API host only
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

CORS: set `CORS_ORIGINS` on the API to include your Vercel URL.

## CLI (optional)

```bash
cd frontend
npx vercel login
npx vercel --prod
```

## Files
- `frontend/vercel.json`
- root `vercel.json` (monorepo helpers; prefer Root Directory = `frontend`)

