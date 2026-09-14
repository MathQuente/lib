## Codebase Overview

Fastify + Prisma + PostgreSQL + Redis backend for "Lib", a personal game-library tracker. Serves a separate React+Vite frontend (`lib-front-end`) via `/api`. Game catalog data comes from IGDB (three-tier strategy: live API, a manually-synced Postgres mirror `games_cache`, and Redis cache-aside).

**Stack**: Fastify 5, Prisma 5, `ioredis`, Zod + `fastify-type-provider-zod`, `@fastify/jwt` + `@fastify/cookie` (httpOnly cookie sessions), `@fastify/oauth2` (Google/Discord, mostly hand-rolled), bcrypt.

**Structure**: layered — `src/routes/` → `src/controllers/` (thin) → `src/services/` (business rules + cache-aside) → `src/repositories/` (sole Prisma/Redis access point per domain, raw `Prisma.sql` only for joins/aggregates Prisma Client can't express). No DI container.

For detailed architecture, full route map, Prisma schema, auth flow, IGDB caching strategy, and known gotchas (including a `.env` with committed secrets — check before sharing this repo), see [docs/CODEBASE_MAP.md](docs/CODEBASE_MAP.md).
