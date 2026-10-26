# Mộc data and compatibility constraints

Paths below are relative to the backend root. App: `../TruyenReader` (Expo + local SQLite). Web: `../TruyenWeb` (React + Vite + static data, browser-local progress). The runtime now stores users and per-user progress in PostgreSQL through Docker Compose. Guest progress and bookmarks remain local; account progress uses a persistent offline queue and compare-and-set revisions. Do not remove local reading as a side effect of backend work.

## Identity and ordering

Read the current source, not only a proposed schema:

- `../TruyenReader/src/domain/book-format.ts`: JSON validation, `fold`, `stableId`, chapter identity and table schema.
- `../TruyenReader/src/data/library.ts`: progress, bookmarks, paging and seed update semantics.
- `../TruyenWeb/src/domain/types.ts`, `src/data/catalog.ts`, `src/data/reader-store.ts`: versioned content and browser progress.

Input is an array with `ten_truyen`, integer `so_chuong`, `ten_chuong`, `noi_dung`, optional `url`. One file is one book. Reject a downloader error report or empty chapter. Preserve paragraph breaks; normalize display text to NFC without changing source-based identifiers.

Existing book/chapter IDs are 16-character deterministic hashes, NOT UUIDs. Chapter identity is URL when present; otherwise the legacy fallback includes chapter number, title and content with U+001F separators. The JS hash processes UTF-16 code units and 32-bit multiplication; a naive Python loop over Unicode code points is not identical for non-BMP text. If generating legacy IDs in Python, cross-check against the actual JS implementation with Vietnamese and emoji fixtures. Prefer retaining supplied legacy IDs or explicit unique `legacy_id` fields alongside new UUID primary keys.

`position` is zero-based ordering within a book; `number` is the displayed chapter number. Multiple parts may have the same number and different URLs. Do not enforce uniqueness on `(book_id, number)`, use chapter identity and `(book_id, position)` uniqueness plus proper indexes. Repeated identical URL/content can be deduplicated; same URL with conflicting content must be reported, not silently overwritten.

## Proposed storage when implementation is requested

Plan separate books, chapters, users, progress and bookmarks, then migrations. Keep full chapter text out of catalog and TOC projections. Favor unique `(user_id, book_id)` progress and `(user_id, book_id, chapter_id)` bookmarks. Use foreign keys and authorization so the chapter belongs to the selected book; preserve an explicit legacy ID mapping when migrating.

App stores a pixel offset; web stores a bounded ratio in [0,1]. Do not equate these values during future sync. A progress contract should carry chapter identity, content revision, location kind/value and update/version metadata. Define conflict handling for offline updates before promising cross-device sync. Progress should not automatically advance to a “max chapter” because readers can intentionally go back.

Imports run in bounded batches, validate before publishing a new revision and retain the previously usable revision if parsing fails. Maintain progress/bookmarks for surviving chapter identities. Missing chapters and conflict policy must be reported. New metadata endpoints fetch only metadata; detail fetches only the opened chapter or a bounded chunk. Match the app's 50-item page behavior while converting the API's one-based page index at the adapter boundary.

Do not set up migrations, import the real novel to a hosted service or add a background worker in a documentation-only preparation task. A large import implementation should expose an explicit CLI/task, not run at application import or server startup.
