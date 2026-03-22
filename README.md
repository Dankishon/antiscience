# flower-survey

Monorepo scaffold for a survey platform with:

- `apps/frontend` on Next.js (`3000`)
- `apps/backend` on NestJS (`4000`)
- `packages/shared` for shared TypeScript contracts
- PostgreSQL in Docker (`5432`)

## Structure

```text
apps/
  backend/
  frontend/
packages/
  shared/
docker-compose.yml
```

## Environment

Copy the example file and adjust secrets as needed:

```bash
cp .env.example .env
```

Required variables:

- `DATABASE_URL`
- `JWT_SECRET`
- `CORS_ORIGINS`
- `OAUTH_CLIENT_ID`
- `OAUTH_CLIENT_SECRET`
- `OAUTH_CALLBACK_URL`

## Install

```bash
npm install
```

## Run with Docker

Start PostgreSQL and Adminer:

```bash
docker compose up -d postgres adminer
```

Adminer will be available at `http://localhost:8080`.

## Prisma

The PostgreSQL schema lives in `prisma/schema.prisma`, Prisma CLI config is in `prisma.config.ts`,
and the first migration is stored in `prisma/migrations`.

```bash
npm run prisma:validate
npm run prisma:generate
npm run prisma:migrate:dev
npm run db:seed
```

For CI or production deploys:

```bash
npm run prisma:migrate:deploy
```

## Development

Run the full monorepo:

```bash
npm run dev
```

Or run services separately:

```bash
npm run dev:frontend
npm run dev:backend
npm run dev:shared
```

Useful endpoints:

- Frontend: `http://localhost:3000`
- Backend health: `http://localhost:4000/api/health`
- Backend metrics: `http://localhost:4000/api/metrics`
- PostgreSQL: `localhost:5432`

Frontend questionnaire flow:

- `/questionnaire` loads the active survey from backend, restores a local draft, saves answers incrementally, and submits to `/result?responseId=...`.
- Frontend API calls are proxied through Next route handlers under `/api/v1/*`, `/api/auth/*`, `/api/admin/*`, and `/api/me/*` to `BACKEND_ORIGIN` or `http://127.0.0.1:4000` by default.
- The proxy now forwards cookies, `Authorization`, `x-user-id`, and `x-request-id`, and preserves backend response headers such as `x-request-id`.

## Observability and Security

Backend:

- Every request receives `x-request-id`; incoming `x-request-id` is preserved when provided.
- Structured JSON request logs are emitted in dev/prod when `ENABLE_STRUCTURED_LOGS=true`.
- `/api/metrics` exposes in-memory counters for completions, errors, and latency summary.
- API responses set `Content-Security-Policy`, `Referrer-Policy`, and `X-Content-Type-Options`; `Strict-Transport-Security` is enabled only in production.
- CORS is allowlist-based via `CORS_ORIGINS`, allows credentials, and still permits top-level requests without an `Origin` header so future OAuth callback redirects are not blocked.

Frontend:

- Next.js applies `Content-Security-Policy`, `Referrer-Policy`, and `X-Content-Type-Options` on app responses.
- `Strict-Transport-Security` is added only in production builds.
- Dev CSP keeps `ws://localhost:3000` and backend origin in `connect-src` so local HMR and API proxying continue to work.

## Admin Analytics Export

CSV export with date range and pagination:

```bash
curl -sS \
  --cookie "flower_survey_access_token=<access-cookie>" \
  "http://localhost:4000/api/admin/analytics/export?format=csv&from=2026-03-22T00:00:00.000Z&to=2026-03-22T23:59:59.999Z&page=1&limit=100" \
  -o analytics.csv
```

JSON export:

```bash
curl -sS \
  --cookie "flower_survey_access_token=<access-cookie>" \
  "http://localhost:4000/api/admin/analytics/export?format=json&from=2026-03-22T00:00:00.000Z&to=2026-03-22T23:59:59.999Z&page=1&limit=100"
```

## GDPR Self-Service

Authenticated user endpoints:

- `GET /api/me/export` downloads a JSON export with the current profile, refresh-token metadata, identified response sessions, answers, computed results, and user-authored audit entries.
- `POST /api/me/delete` requires `{ "confirmation": "DELETE" }`, removes the user account plus linked identified sessions and refresh tokens, clears auth cookies, and keeps only an anonymized deletion audit record.

Example export:

```bash
curl -sS \
  --cookie "flower_survey_access_token=<access-cookie>" \
  "http://localhost:4000/api/me/export" \
  -o me-export.json
```

Example deletion:

```bash
curl -sS \
  --cookie "flower_survey_access_token=<access-cookie>" \
  -H "Content-Type: application/json" \
  -X POST \
  "http://localhost:4000/api/me/delete" \
  -d '{"confirmation":"DELETE","reason":"user_request"}'
```

Anonymous-session retention is managed via admin API:

- `GET /api/admin/retention/anonymous-sessions`
- `PUT /api/admin/retention/anonymous-sessions`

Example retention update with immediate cleanup:

```bash
curl -sS \
  --cookie "flower_survey_access_token=<access-cookie>" \
  -H "Content-Type: application/json" \
  -X PUT \
  "http://localhost:4000/api/admin/retention/anonymous-sessions" \
  -d '{"retentionDays":30,"runCleanup":true}'
```

Notes:

- Retention cleanup deletes only anonymous sessions older than the configured cutoff.
- Audit log entries tied to a deleted account are anonymized; the dedicated GDPR erasure record does not retain deleted personal data.
- In the current prototype runtime, auth, sessions, and retention settings are stored in memory rather than PostgreSQL.

## Quality Checks

```bash
npm run lint
npm run test
npm run typecheck
npm run format
```

Frontend end-to-end flow:

```bash
npm run test:e2e -w @flower-survey/frontend
```

## Notes

- `@flower-survey/shared` contains common contracts and UI copy.
- Root ESLint and Prettier configs are shared across all workspaces.
- Vitest is configured for `frontend`, `backend`, and `shared`.
