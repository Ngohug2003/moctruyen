---
name: moc-vite-reader
description: Implement and maintain the Mộc React/Vite web reader in TruyenWeb, including reader UI, paginated catalog access, offline fallback and account progress sync.
---

# Mộc Vite reader

Apply only within TruyenWeb. Read AGENTS.md and relevant folder rules. App.tsx handles route/layout composition; page behavior belongs in src/features. Keep API transport in src/api, catalog/state adapters in src/data and pure algorithms/types in src/domain.

Retain the green/cream/night identity, icons, Vietnamese typography, bounded covers, mobile layout and accessible dialog/keyboard behavior. Shared controls belong in src/ui; asynchronous resource behavior belongs in src/hooks. Do not reload the full novel or reset progress when only appearance changes.

Catalog and TOC projections exclude chapter bodies and preserve 50-item pagination. Fetch chapter text on opening. Keep the versioned static fallback, stable IDs and duplicate-number parts. scripts/prepare-books.mjs publishes local JSON/bundled data; generated books and input JSON remain untracked.

src/api/cloud.ts uses VITE_API_URL; empty is same-origin for the Docker reverse proxy. Dockerfiles, Compose and Nginx configuration live in ../TruyenBackend. Account state is partitioned by user; guest state remains separate. Keep sessionStorage credentials, persisted offline updates, expected_revision handling and web progress ratios.

Run npm run validate and build after implementation. UI/navigation changes require the browser suite; authentication/sync changes require the auth browser suite against the running local backend. Keep generated screenshots/reports out of Git. Do not publish a site or change remote resources merely to validate local code.

Local reading is the default, not a last-resort network fallback. Return packaged catalog, TOC, chapter and cultivation data without calling API when available, even if signed in. Keep network content reads as fallback for missing local data. Web startup must work without Docker or a running backend; test with API requests blocked.
