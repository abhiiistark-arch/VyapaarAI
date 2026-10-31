#!/bin/sh
set -e

cd /app/backend
uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} &

cd /app/frontend
HOSTNAME=0.0.0.0 PORT=${FRONTEND_PORT:-3000} node server.js &

wait -n
