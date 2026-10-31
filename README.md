# VyapaarAI

## Local

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Demo: `owner@rajveerchinese.demo` / `vyapaarai123`

## Vercel (important)

1. **Root Directory** = `frontend`
2. **Output Directory** = **empty** (never `frontend/.next`)
3. Framework = Next.js, default install/build
4. Env: `SECRET_KEY`, `GEMINI_API_KEY`, `DEMO_MODE=true`

Full notes: `deploy/VERCEL.md`
