# Validation and deployment boundaries

## Current runtime

Docker Compose, API, explicit migrations and seed are implemented. Run Compose from the backend directory using .docker.env; preserve the existing volume. Prefer the isolated db-test/tests profile for integration checks; never point tests at the runtime database. Read README.md for actual verification and limitations. Historical happyvow review probes are not the Mộc application test suite.

## When implementing the runtime

Create a Python 3.12 project-local virtual environment and compatible lock/pins. Include explicit runtime dependencies (e.g. pydantic-settings/email validation, async driver) instead of relying on accidental transitive imports. Define dev tooling in the project manifest; preferred local tools are Ruff for lint/format, pytest with async support, and type checking where configured. Run only actual installed/configured commands; never report a missing test suite as passing.

Recommended checks after bootstrap:

```text
python -m ruff check app tests
python -m ruff format --check app tests
python -m pytest
python -m pip check
```

Use HTTP tests for envelope/status/OpenAPI consistency, request validation, 401/403, malformed/expired tokens, private resource ownership, duplicate conflict responses and omission of password/hash fields. Use async service tests for rollback across repositories. Use isolated PostgreSQL integration tests for UUIDs, constraints, ILIKE/search, concurrent writes and migrations; SQLite or mocked sessions cannot establish those guarantees.

Test import fixtures with duplicate-number parts, duplicate URL, Unicode, invalid JSON, failed batch rollback and preservation of progress/deduplication IDs. For paging, cross the 50/51 boundary and confirm no repeated/skipped items and no body in metadata. If client integration changes, also run the app/web checks relevant to that adapter.

## Alembic/Compose

For migrations, confirm a single shared settings/URL and Base registry. Review autogeneration, test `upgrade head` against an isolated DB, check metadata drift, and test downgrade/re-upgrade only where reversible on disposable data. Never run `reset-db`, `down -v`, downgrade or destructive SQL against user/production data as a validation shortcut.

The upstream `docker-compose-migrate.yml` defines a different DB without the application's data volume. Do not reuse that deployment. A future Mộc migration service must connect to the SAME configured database/volume as the API; prefer an explicit one-shot migrate service with a successful exit propagated to the caller. No silent fallback database URL. Avoid fixed container names/host ports that collide with other projects. Use variable-correct health checks (`DB_USER`, database name) and keep passwords out of output.

Dev reload/mounted source can be a development override. Deployment images should be non-root, exclude `.env`, logs, VCS and local data using `.dockerignore`, omit `--reload`, and dispose the async engine on shutdown. Review dependency security and compatibility at implementation time; the source's old pins have not been audited for advisories in this preparation.

Deploy only within the user's requested scope. A local backend build does not imply authorization to create paid resources or publish credentials/data. If a necessary external config is missing, finish local code and tests, then state the exact remaining input.
