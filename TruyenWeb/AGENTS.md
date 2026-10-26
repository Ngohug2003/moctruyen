# Mộc web rules

Scope: this React/Vite web only. Use `.agents/skills/moc-vite-reader/SKILL.md` for web work.

Keep C:/Truyen folder-only at the top level (including the .git directory). Git tracks all projects from that root; never create a nested repository. Keep secrets, input novels, generated bundles, dependencies and build output untracked. Docker configuration belongs only to TruyenBackend. Preserve the green/cream/night branding and guest offline reading. Update imports, scripts, tests and documentation together when moving files. Do not add one-off status probes or generated check reports to source; keep meaningful automated tests and required build guards. No hosted deployment or Git push is implied by a code change.

- `src/App.tsx` composes routing/layout. `src/features` owns library, saved items, book detail, reader, preferences and account UI.
- `src/api` owns API transport, authentication and sync; `src/data` owns catalog access and reader state; `src/domain` owns pure types/algorithms. `src/hooks`, `src/ui` and navigation.ts are shared presentation/navigation utilities.
- API catalog/chapter reads retain the static offline fallback. Lists contain metadata only; TOC pages contain at most 50 entries. Do not fetch all chapter bodies at startup or rewrite stable IDs.
- Web progress uses a ratio in [0,1]. Preserve account-local state partitions, persistent pending updates and expected_revision conflicts. Session tokens stay in sessionStorage; do not put credentials in query strings or logs.
- VITE_API_URL empty means same-origin /api through Docker Nginx; local Vite defaults to the backend port. Keep Docker/Nginx files in the backend; do not create deployment files here.
- Verify with `npm run validate`, build and the browser suites for changed UI/auth flows. Screenshot/test output is temporary and must stay ignored.

## Reading without a backend

Read packaged local content before any API request, including signed-in sessions. Web uses prepared JSON metadata/chunks; mobile uses SQLite metadata and JSON-derived packaged chunks. Neither reading nor cultivation lookup may wait on API when local data exists. Only try content APIs if local content is unavailable; keep authentication/sync optional in the background. Do not change account/guest progress isolation.
