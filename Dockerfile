# Multi-stage image for VPS deploy: API + static Next.js behind one process supervisor.
FROM node:22-alpine AS frontend-build
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_API_URL=/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

FROM python:3.11-slim AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend ./backend
COPY --from=frontend-build /frontend/.next/standalone ./frontend
COPY --from=frontend-build /frontend/.next/static ./frontend/.next/static
COPY --from=frontend-build /frontend/public ./frontend/public

COPY deploy/start.sh /start.sh
RUN chmod +x /start.sh

ENV APP_NAME=VyapaarAI
ENV PYTHONUNBUFFERED=1
ENV PORT=8000
ENV FRONTEND_PORT=3000

EXPOSE 8000 3000
CMD ["/start.sh"]
