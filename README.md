# Цветочный профиль

Проект переведён на целевую production-архитектуру:

- `frontend` — React + Vite
- `backend` — Python + FastAPI
- `postgres` — PostgreSQL
- `nginx` — reverse proxy

## Контейнеры

- `frontend` собирает статический React-клиент
- `backend` запускает FastAPI через `gunicorn + uvicorn workers`
- `postgres` хранит пользователей, сессии ответов и результаты
- `nginx` отдаёт frontend и проксирует `/api/*` в backend

Путь трафика:

- `http://localhost:8080/` → `nginx` → `frontend`
- `http://localhost:8080/api/*` → `nginx` → `backend`
- `backend` → `postgres:5432`

## Что реализовано

- авторизация по `username + password`
- отдельный гостевой вход
- активный опросник на 30 вопросов
- расчёт цветочного профиля на backend
- хранение пользователей, ответов и результатов в PostgreSQL
- единая точка входа через Nginx

## Быстрый старт

1. Скопируйте пример окружения:

```bash
cp .env.example .env
```

2. Запустите стек:

```bash
docker compose up --build
```

Приложение будет доступно на:

- `http://localhost:8080`

PostgreSQL будет доступен на:

- `localhost:5432`

## Основные переменные

- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `SECRET_KEY`
- `SESSION_TTL_MINUTES`
- `APP_PORT`

`DATABASE_URL` можно не задавать вручную: backend соберёт DSN из `POSTGRES_*`.

## Управление стеком

Остановить контейнеры:

```bash
docker compose down
```

Пересоздать базу данных с чистого состояния:

```bash
docker compose down -v
docker compose up --build
```

## Проверка после старта

- `docker compose ps` — все 4 сервиса должны быть `healthy`
- `docker compose exec -T nginx wget -qO- http://127.0.0.1/api/health`
- `docker compose exec -T backend python -c "from sqlalchemy import create_engine, text; import os; url = os.environ.get('DATABASE_URL') or 'postgresql+psycopg://{user}:{password}@{host}:{port}/{db}'.format(user=os.environ['POSTGRES_USER'], password=os.environ['POSTGRES_PASSWORD'], host=os.environ['POSTGRES_HOST'], port=os.environ['POSTGRES_PORT'], db=os.environ['POSTGRES_DB']); engine = create_engine(url); conn = engine.connect(); print(conn.execute(text('select 1')).scalar()); conn.close()"`

## Backend API

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/guest`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `GET /api/v1/survey/active`
- `POST /api/v1/responses`
- `PUT /api/v1/responses/{session_id}/answers`
- `POST /api/v1/responses/{session_id}/submit`
- `GET /api/v1/responses/{session_id}/result`
- `GET /api/v1/me/results`
- `GET /api/v1/me/results/{id}`
- `DELETE /api/v1/me/results/{id}`
- `GET /api/v1/admin/analytics/summary`
- `GET /api/v1/admin/analytics/export`
- `GET /api/health`

## Итоговое дерево

```text
.
├── .dockerignore
├── .editorconfig
├── .env.example
├── .gitignore
├── README.md
├── backend
│   ├── Dockerfile
│   ├── alembic
│   │   ├── env.py
│   │   └── versions
│   │       ├── 202603230001_initial_schema.py
│   │       ├── 202603230002_auth_sessions_and_roles.py
│   │       └── 202603230003_results_analytics_model.py
│   ├── alembic.ini
│   ├── app
│   │   ├── api
│   │   ├── core
│   │   ├── db
│   │   ├── models
│   │   ├── schemas
│   │   ├── services
│   │   ├── main.py
│   │   └── seed_data.py
│   ├── entrypoint.sh
│   └── requirements.txt
├── docker-compose.yml
├── frontend
│   ├── Dockerfile
│   ├── default.conf
│   ├── index.html
│   ├── package.json
│   ├── src
│   │   ├── components
│   │   ├── lib
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── styles.css
│   ├── tsconfig.json
│   └── vite.config.ts
├── nginx
│   ├── Dockerfile
│   └── default.conf
├── seeds
│   ├── interps.v1.json
│   └── questions.v1.json
```

## Примечания

- backend при старте применяет миграции Alembic и загружает активный опросник из `seeds/*.json`
- frontend работает через тот же origin, что и backend, поэтому авторизация остаётся простой и предсказуемой
- reverse proxy направляет `/api/*` в FastAPI, а остальные запросы — во frontend
