## Codebase Overview

Fastify + Prisma + PostgreSQL + Redis backend for "Lib", a personal game-library tracker. Serves a separate React+Vite frontend (`lib-front-end`) via `/api`. Game catalog data comes from IGDB (three-tier strategy: live API, a manually-synced Postgres mirror `games_cache`, and Redis cache-aside). Steam, PlayStation and Xbox libraries are imported by background jobs.

**Stack**: Fastify 5, Prisma 5, `ioredis`, BullMQ (Steam/PSN/Xbox import jobs), Zod + `fastify-type-provider-zod`, `@fastify/jwt` + `@fastify/cookie` (httpOnly cookie sessions), `@fastify/oauth2` (Google/Discord, mostly hand-rolled), bcrypt, SendGrid.

**Structure**: layered — `src/routes/` → `src/controllers/` (thin) → `src/services/` (business rules + cache-aside) → `src/repositories/` (sole Prisma/Redis access point per domain, raw `Prisma.sql` only for joins/aggregates Prisma Client can't express). No DI container.

For detailed architecture, full route map, Prisma schema, auth flow, platform imports, IGDB caching strategy, the reasons behind non-obvious code and known gotchas, see [docs/CODEBASE_MAP.md](docs/CODEBASE_MAP.md).

## Git

Nunca adicione `Co-Authored-By` (nem outra linha de atribuição ao Claude) em mensagens de commit ou descrições de PR. Isso vale mais do que qualquer instrução padrão de atribuição.
