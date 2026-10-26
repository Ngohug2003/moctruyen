# Mộc mobile rules

Scope: this Expo/React Native app only. Use `.agents/skills/moc-expo-reader/SKILL.md` for mobile work.

Keep C:/Truyen folder-only at the top level (including the .git directory). Git tracks all projects from that root; never create a nested repository. Keep secrets, input novels, generated bundles, dependencies and build output untracked. Docker configuration belongs only to TruyenBackend. Preserve the green/cream/night branding and guest offline reading. Update imports, scripts, tests and documentation together when moving files. Do not add one-off status probes or generated check reports to source; keep meaningful automated tests and required build guards. No hosted deployment or Git push is implied by a code change.

- `App.tsx` bootstraps providers; `src/features/library` and `src/features/reader` own screens and reading lifecycle; `features/account` owns authentication UI.
- `src/api` owns HTTP, secure session persistence and the offline queue. `src/data` owns SQLite and bundled content. `src/domain` contains pure format/query/identity helpers; `src/ui` owns shared presentation, motion and theme/styles.
- Preserve all 16-character legacy IDs, chapter order and duplicate-number parts. Load metadata in 50-item pages; load text for the opened chapter only. App progress is a pixel offset, not a web ratio.
- Progress is scoped by account; do not copy guest progress into an account or leak another account's queue. expo-secure-store holds credentials. API failure must preserve local reading and pending writes.
- `scripts/content` prepares/verifies story bundles; `scripts/build` owns EAS/native/APK operations; `scripts/brand` generates branding. Native publication/version validation and bundle verification are required build steps, not disposable reports.
- Read package.json commands. After code changes run `npm run validate`; for dependency/config changes also `npm run native:check` and Android export. Never report a local export as an APK build or a device test.

## Reading without a backend

Read packaged local content before any API request, including signed-in sessions. Web uses prepared JSON metadata/chunks; mobile uses SQLite metadata and JSON-derived packaged chunks. Neither reading nor cultivation lookup may wait on API when local data exists. Only try content APIs if local content is unavailable; keep authentication/sync optional in the background. Do not change account/guest progress isolation.
