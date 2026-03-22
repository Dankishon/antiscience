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
- PostgreSQL: `localhost:5432`

## Quality Checks

```bash
npm run lint
npm run test
npm run typecheck
npm run format
```

## Notes

- `@flower-survey/shared` contains common contracts and UI copy.
- Root ESLint and Prettier configs are shared across all workspaces.
- Vitest is configured for `frontend`, `backend`, and `shared`.
