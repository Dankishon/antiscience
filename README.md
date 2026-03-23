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
- `ACCESS_TOKEN_EXPIRE_MINUTES`
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

## Backend API

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/guest`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/survey/active`
- `POST /api/responses`
- `PUT /api/responses/{session_id}/answers`
- `POST /api/responses/{session_id}/submit`
- `GET /api/responses/{session_id}/result`
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
│   │       └── 202603230001_initial_schema.py
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
