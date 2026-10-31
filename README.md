# VyapaarAI

AI-powered Google Business Profile management for local businesses and agencies.

## What’s running now

- **White / light UI** product shell
- **Demo mode** with rich **Rajveer Chinese (Vadjal, Satara)** data from `chinese_web`
- **Gemini** for descriptions, review drafts, and assistant
- **Live Google GBP** can be switched on later with env flags only

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

When Google approves your project:

```
DEMO_MODE=false
USE_LIVE_GOOGLE=true
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://YOUR_DOMAIN/api/v1/google/callback
```

Restart the API. Connect then opens Google’s **permissions** page directly (`prompt=consent`, scope `business.manage`).

## Local run

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
# edit .env — keep DEMO_MODE=true, add GEMINI_API_KEY
uvicorn app.main:app --reload --port 8001
```

Gemini free-tier model that works with the current key: `gemini-3.8-flash`  
(also works: `gemini-3.5-flash-lite`, `gemini-flash-lite-latest`)

### Frontend

```bash
cd frontend
npm install
# NEXT_PUBLIC_API_URL=http://localhost:8001/api/v1 in .env.local
npm run dev
```

Open http://localhost:3000  
Demo login: `owner@rajveerchinese.demo` / `vyapaarai123`

## VPS deploy (Docker)

```bash
# on the server, from project root
cp backend/.env.example backend/.env
# fill GEMINI_API_KEY, SECRET_KEY, FRONTEND_URL, BACKEND_URL, CORS_ORIGINS

docker compose up -d --build
```

- Web: port `3000`
- API: port `8000`

Optional Postgres/Redis:

```bash
docker compose --profile full up -d
```

Then set `DATABASE_URL=postgresql+psycopg://vyapaarai:vyapaarai@postgres:5432/vyapaarai` in `backend/.env`.

## Vercel (frontend only)

Vercel free = Next.js frontend. API stays on VPS/Railway/Render.

```bash
npm i -g vercel
cd frontend
vercel login
vercel                 # preview
vercel --prod          # production
```

Dashboard: Root Directory = `frontend`, Framework = Next.js.  
Env: `NEXT_PUBLIC_API_URL=https://YOUR-API-HOST/api/v1`

Config files: `frontend/vercel.json`, `frontend/vercel.toml` (notes), root `vercel.json`, details in `deploy/VERCEL.md`.

## Health

`GET /health` and `GET /api/v1/system/mode` show demo vs live Google status.
