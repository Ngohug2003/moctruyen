# Mộc web

React + Vite reader with the Mộc palette, local JSON catalog, optional account progress sync and versioned reading content.

`CHAY_WEB.bat` opens the standalone Vite reader at http://localhost:5178 without starting backend or Docker. All Docker files are in `../TruyenBackend`. `CHAY_WEB_DEV.bat` runs the same Vite development command.

```powershell
cd C:\Truyen\TruyenWeb
npm ci
npm run dev
```

| Location                           | Responsibility                                                     |
| ---------------------------------- | ------------------------------------------------------------------ |
| `src/App.tsx`, `src/navigation.ts` | Application composition and hash routes                            |
| `src/features`                     | Library, saved items, book detail, reader, preferences and account |
| `src/api`                          | HTTP, auth and offline sync queue                                  |
| `src/data`                         | Catalog adapter and reader state                                   |
| `src/domain`                       | Types and pure reader algorithms                                   |
| `src/hooks`, `src/ui`              | Resource loading and reusable controls                             |
| `scripts`                          | Publish local reading data                                         |
| `tests`                            | Unit and browser regression tests                                  |

VITE_API_URL configures the API. Empty means same-origin `/api` in Docker; Vite defaults to the machine's port 8000. Reading metadata is paginated, chapter bodies load on opening, and prepared static JSON is the default reading source. Account progress is isolated from guest progress. Browser session credentials use sessionStorage.

For a fresh clone, prepare app JSON first or put a novel JSON into `input`, then run `npm run prepare:books`. Input JSON and generated `public/books` are intentionally untracked. Keep license files and branding sources.

```powershell
npm run validate
npm run build
npm run test:browser
npm run test:auth
npm run test:cultivation
npm run test:local
```

Reader and local-reading browser suites work against standalone Vite; pass its URL as an argument. The auth suite requires the local backend. Screenshots and test output are disposable. Production hosting requires HTTPS and corresponding API/CORS configuration.

Cảnh giới Đế Bá: nút “Cảnh giới” ở thư viện/thông tin truyện và màn hình đọc. Hỗ trợ chọn giới vực, tìm tên không dấu, tiểu cảnh và nguồn đối chiếu. Bản JSON nhỏ đóng gói được đọc trước; API từ database dùng khi thiếu dữ liệu cục bộ. Dữ liệu gốc ở `../TruyenBackend/data/cultivation/de-ba.json`, được sao chép khi chuẩn bị nội dung.

Local JSON is read first for library, TOC, chapter text and cultivation data. Missing local content may fall back to API; available JSON never waits for an API timeout. Reading and local progress do not require signing in. API is needed only for account operations, sync and content absent from the local bundle. The app/web server itself still needs to be running to serve JSON; this is backend-independent reading, not a PWA full-network-offline installation.
