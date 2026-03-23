#!/bin/sh
set -e

cd /srv/app/backend
alembic upgrade head
python -m app.seed_data

exec gunicorn app.main:app \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --workers "${GUNICORN_WORKERS:-2}" \
  --timeout 60
