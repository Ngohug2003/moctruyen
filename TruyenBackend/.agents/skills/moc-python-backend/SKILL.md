---
name: moc-python-backend
description: Build or review Python APIs for the Mộc novel reader in C:/Truyen/TruyenBackend using the reviewed happyvow-api folder conventions, FastAPI, async SQLAlchemy and Alembic. Use for backend scaffolding, endpoints, auth, repositories, schemas, migrations and imports; not for standalone React/Vite or Expo UI changes.
---

# Mộc Python backend

Apply this skill only inside the Mộc backend at `C:/Truyen/TruyenBackend`. Resolve this backend root from the current checkout. Read applicable parent rules, the backend `AGENTS.md`, and rules in the folders being changed. The backend-local skill lives at `.agents/skills/moc-python-backend` relative to the backend root; it is not installed globally and does not apply to app or web work.

The reference is `Ngohug2003/happyvow-api`, reviewed at commit `458aa03885bb86e57caa46a4fa2f028a45f16f42`. It is an architecture reference, not a working production template. Follow the reviewed local architecture rules; the upstream repository is a reference, not a runtime dependency.

## Read what applies

- Before adding a feature, read [architecture.md](references/architecture.md) for module ownership and transaction boundaries.
- For endpoints, auth or DTOs, read [api-contract.md](references/api-contract.md).
- For book/chapter imports, offline IDs, progress or pagination, read [reader-data.md](references/reader-data.md).
- For setup, tests, migrations or deployment, read [validation.md](references/validation.md).

## Working agreement

The runtime now includes FastAPI, PostgreSQL, migrations, seed, account sessions and progress sync. The user selected Docker Compose: use `C:/Truyen/TruyenBackend/compose.yaml` and `.docker.env`; read the backend README for verified commands. Use only the configured Docker database and check container readiness. Preserve existing Docker volumes. Do not create a hosted database merely to complete a local code task.

Keep the recognizable base layout: `routes` aggregates API versions, `controllers` contains thin FastAPI endpoint adapters, `services` owns use cases and write transactions, `repositories` owns SQL, `models` maps tables, and `schemas/requests` / `schemas/responses` defines input/output. The README of the reference calls controllers “business logic”, but its actual auth flow uses services; follow the reviewed Mộc mapping.

Use one settings object and one declarative ORM base. Keep `/api/v1` versioning and the `public`, `auth`, `admin` groups; add `reader` for authenticated progress/bookmarks. Keep frontend and mobile adapters independent of the storage implementation. Do not change reader branding or remove existing local reading behavior as a side effect of backend work.

Do not reproduce the reference's raw password/token logging, default signing secret, access-as-refresh flow, mixed response envelopes, separate migration database, or repository-level commits. These corrections are part of the Mộc conventions, not claims that upstream already implements them.

For each feature: identify the touched layer rules, define the request/response and authorization contract, implement only the necessary layers, and test actual HTTP payloads plus relevant SQL behavior. If storage changes are requested, include a reviewed Alembic revision rather than runtime `create_all`. Report what was executed and what remains unverified. Writing code alone is not evidence that an API or migration works.
