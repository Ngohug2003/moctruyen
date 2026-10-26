# Reviewed folder conventions

These are local Mộc decisions informed by the upstream source, not a verbatim copy of its design.

| Location | Owns | Boundary |
|---|---|---|
| `app/main.py` | Application factory/lifespan, CORS, exception handlers, router mounting | No queries, imports, seeds or migrations at module import/startup |
| `app/constants/config.py` | One typed Pydantic settings instance | API, database, Alembic and auth import the same settings |
| `app/constants/database.py` | Engine, sessionmaker, one `Base`, request session dependency | No duplicate `BaseDbModel(DeclarativeBase)` registry |
| `app/routes/api_v1.py` | Version/group composition | Mount `/api` and `/v1` exactly once |
| `app/controllers/{public,auth,admin,reader}` | FastAPI routers, validated inputs/dependencies, calling services, response DTOs | No SQL, hashing, file parsing or direct repository calls |
| `app/services` | Business rules, authorization ownership checks and transaction orchestration | Framework-independent values/exceptions, no `JSONResponse` |
| `app/repositories` | Parameterized SQLAlchemy queries, bounded lists, flush/refresh | No commit/rollback, no HTTP exceptions |
| `app/models` | Columns, constraints, indexes and relationships | No generic CRUD/SQL helper mixin or route dependencies |
| `app/schemas/requests` | Validated inputs | Separate admin input from public registration; forbid privilege fields |
| `app/schemas/responses` | Typed DTOs, envelope and pagination | Explicit fields; never ORM objects or password hashes |
| `app/middlewares` | Authentication and role/ownership dependencies | Missing/bad/expired token → 401; authenticated forbidden → 403 |
| `app/migrations` | Alembic env and reviewed revisions | Same DB/session settings/Base as runtime; import model metadata |
| `app/commands` | Explicit import/seed CLI entrypoints | Reuse service/import logic; bounded work, repeatable results |
| `app/tasks` | Optional background processing | Add only for a concrete long-running task; own session, retry idempotently |
| `app/utils` | Small shared pure helpers, domain exceptions, safe logging/security | No second settings owner or generic dumping of requests |
| `tests` | Contract, service, repository and migration behavior | Isolated test DB; never default to a deployment URL |

## Dependency direction

`main → routes → controllers → services → repositories → models`

Schemas/constants/utilities may be imported where appropriate. Models must not import repositories, controllers, or services. Auth dependencies may call an authentication service which loads the current user; HTTP semantics remain at the boundary. Use explicit imports in aggregators instead of `import *`.

## Transactions

Use one session per request. A mutating service orchestrates the atomic unit and owns commit or a single `async with session.begin()` boundary. Repositories use `add`, `execute`, `flush` and `refresh` only. Authentication reads may autobegin a transaction before the service runs: do not blindly call `session.begin()` on an already-active session. Choose a request/session transaction policy once at bootstrap and test a read-auth → write-service flow.

For multi-repository operations, a failure must leave no partial writes. Avoid nested commits, shared sessions across concurrent tasks and async lazy-loading during serialization. Map database uniqueness conflicts to the documented 409 after rollback; a preflight lookup alone cannot prevent races.

## Models/settings decisions

Use Python 3.12 as the reviewed runtime baseline. Choose supported, compatible library versions when runtime setup is requested and lock/test them; do not copy the 2024-era dependency pins unquestioningly. SQLAlchemy 2 async + asyncpg, Pydantic 2, Alembic and PostgreSQL are the inherited technology direction, with actual DB provisioning deferred.

A single `Base` in `constants/database.py`; an optional abstract timestamp/UUID model in `models/base.py` inherits that Base. UUID identity is fine for new entities; preserve explicit legacy IDs for existing app/web content (see reader-data.md). Use timezone-aware timestamps and ISO 8601 at the API boundary. Choose `uuid.uuid4` or a deliberately migrated server UUID default; do not mix integer actor columns with UUID user keys.
