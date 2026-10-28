# Mộc backend

FastAPI + async SQLAlchemy + PostgreSQL 16. Migrations, seed, API and web run through Docker Compose from this folder.

```powershell
cd C:\Truyen\TruyenBackend
.\CHAY_DOCKER.bat
```

Web: http://localhost:5178. Swagger: http://localhost:8000/docs. `DUNG_DOCKER.bat` stops services and keeps data in `moc-truyen_postgres_data`. Never use `down -v` to perform routine cleanup. `.docker.env` contains the generated local password and is not tracked; `.docker.env.example` documents configuration.

| Folder | Responsibility |
| --- | --- |
| `app/controllers` | HTTP adapters for public/auth/reader |
| `app/services` | Use cases and ownership rules |
| `app/repositories` | SQL queries, no commits |
| `app/models`, `app/constants` | Schema, settings and one database/session owner |
| `app/schemas` | Validated requests and response DTOs |
| `app/migrations` | Explicit Alembic revisions |
| `app/commands` | Explicit, repeatable book seed |
| `docker` | Web Dockerfile and Nginx configuration |
| `tests` | Isolated PostgreSQL contract tests and test-only cleanup helpers |
| `.agents/skills` | Backend-only implementation conventions |

Endpoints use `/api/v1/public`, `/auth`, `/reader`, envelope `success/message/error_code/data`. Catalog/TOC pages contain metadata only (default 50/max 100); a chapter endpoint returns one body. Registration hashes passwords with Argon2. Login creates a random bearer session, stored hashed in PostgreSQL, expiring after 7 days; logout revokes the session. There is no refresh/password-reset flow or default admin.

Progress belongs to the authenticated user. Updates include chapter_id, version, location_kind/value and expected_revision; conflicts return 409. Native pixel offsets and web ratios stay distinct. Guest progress/bookmarks remain local.

Seed reads `../TruyenWeb/public/books`, mounted read-only, in one transaction per book. Prepare that content from the app JSON before a fresh setup. Existing same-version seed is idempotent; a changed revision requires an explicit import/migration decision. Startup does not create tables or seed implicitly.

```powershell
docker compose --env-file .docker.env ps
docker compose --env-file .docker.env logs --tail 80 api
docker compose --env-file .docker.env --profile test run --rm tests
docker compose --env-file .docker.env exec -T api python -m ruff check --no-cache app tests
docker compose --env-file .docker.env exec -T api python -m ruff format --check --no-cache app tests
docker compose --env-file .docker.env exec -T api python -m alembic check
```

The test profile uses a separate database. The project is local/LAN; hosting requires an HTTPS endpoint and corresponding client configuration. Dockerfiles copy only source/locks, never `.env`, input novels or local credentials. Git root is `C:\Truyen`; backend has no nested Git repository.

Bảng cảnh giới Đế Bá được lưu trong `cultivation_guides`, `realm_systems`, `cultivation_realms`. Migration `0003` thêm schema; seed gọi thêm `python -m app.commands.seed_cultivation`. Dataset chuẩn ở `data/cultivation/de-ba.json`; endpoint public `/api/v1/public/books/{book_id}/cultivation`. Có 7 nhóm giới vực và 68 mục tra cứu, bao gồm nhánh tu luyện và ghi chú nguồn chưa xác nhận. Tên và tiểu cảnh theo ví dụ/ảnh người dùng, biến thể trong bản truyện được giữ làm alias.

Web does not depend on API/DB readiness. Run `docker compose --env-file .docker.env up -d --build web` to serve the bundled JSON reader alone, or use `../TruyenWeb/CHAY_WEB.bat` without Docker. Nginx resolves the optional API on demand, so its absence does not block static reading. Do not start both web servers on port 5178 simultaneously.

## EC2 CI/CD

GitHub Actions now builds/tests backend changes and can deploy main to the existing EC2 server after one-time SSH setup. See [docker/DEPLOY.md](docker/DEPLOY.md) for repository secrets, activation and manual commands. Production CORS and API binding live in `docker/production.env`; database credentials stay in the server `.docker.env`.
