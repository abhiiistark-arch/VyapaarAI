# VyapaarAI VPS deploy

1. Copy project to the server.
2. Fill `backend/.env` (Gemini key, secret, URLs).
3. Keep `DEMO_MODE=true` until GBP approval.
4. Run:

```bash
docker compose up -d --build
```

5. Point Nginx / Cloudflare to:
   - frontend `:3000`
   - API `:8000` (or reverse-proxy `/api` → API)

When Google GBP is approved, flip env flags and recreate the API container.
