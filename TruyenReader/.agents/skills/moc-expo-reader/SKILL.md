---
name: moc-expo-reader
description: Implement and maintain the Mộc Expo/React Native reader in TruyenReader, including offline SQLite reading, mobile account sync, native configuration and APK build tooling.
---

# Mộc Expo reader

Apply only within TruyenReader. Read its AGENTS.md and any rules in touched folders. App.tsx is a provider bootstrap; implement screen changes in src/features, shared UI in src/ui, persistence in src/data and transport in src/api.

Preserve the existing forest/cream/night palette, logos, bounded book cover titles and reduced-motion behavior. A style change must not reset the reading session. Save before navigation/backgrounding and restore a bounded pixel offset. Keep chapter metadata pagination and lazy content loading.

JSON import and build preparation share src/domain/book-format.ts. Do not recalculate legacy IDs differently or collapse multiple parts with the same displayed number. Keep input JSON and generated content files on disk but out of Git; BUILD_APK.bat prepares and verifies them. EAS uses the app root with EAS_NO_VCS so the monorepo move must not upload backend secrets.

Account state uses src/api/cloud.ts with expo-secure-store; src/data/library.ts separates account progress from guest progress. Do not interpret a web ratio as pixels. Preserve the persistent offline queue and optimistic revision conflict behavior.

Use npm run validate after source changes. Native config/dependency changes also need npm run native:check and npm run verify:android. Script moves require updating package.json, their root-directory calculations and test imports. Keep Gradle publication/version and bundle-integrity guards. A successful Android export is not a successful APK build or a phone test.

Local reading is the default, not a last-resort network fallback. Return packaged catalog, TOC, chapter and cultivation data without calling API when available, even if signed in. Keep network content reads as fallback for missing local data. Web startup must work without Docker or a running backend; test with API requests blocked.
