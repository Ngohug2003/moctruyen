# Mộc mobile

Expo SDK 57 / React Native, offline SQLite catalog and lazy chapter content. Keep the existing book JSON in `input/truyen.json`.

```powershell
cd C:\Truyen\TruyenReader
npm ci
npm start
```

`CHAY_THU.bat` starts Expo. `BUILD_APK.bat` prepares content, validates native versions and builds/downloads the APK through the linked Expo project. `BUILD_APK_LOCAL.bat` requires the Android toolchain; `TAI_LAI_APK.bat` downloads an already completed build. No build/upload runs automatically when editing source.

| Location          | Responsibility                             |
| ----------------- | ------------------------------------------ |
| `App.tsx`         | Provider/bootstrap wiring                  |
| `src/features`    | Library, reader and account screens        |
| `src/api`         | HTTP/session/offline sync queue            |
| `src/data`        | SQLite and bundled content                 |
| `src/domain`      | JSON format, IDs and chapter queries/cache |
| `src/ui`          | Theme, styles, motion and shared controls  |
| `scripts/content` | Prepare/verify book assets                 |
| `scripts/build`   | APK/EAS/native build tooling               |
| `scripts/brand`   | Logo/icon generation                       |
| `tests`           | Automated regression coverage              |

Set `EXPO_PUBLIC_API_URL` locally or change the address in the account panel. For LAN use `http://IP-máy-tính:8000`, with Docker running and phone on the same Wi-Fi. Build a new APK after code/native configuration changes. Hosted deployment needs HTTPS.

Login uses secure-store. Reading always uses local SQLite/JSON-derived chunks first, even while signed in; API is tried only if local content is missing. Reading progress is separate for each account and guest; failed sync retains a local queue. Cross-device sync restores the chapter but does not reinterpret web ratios as native pixels. Bookmarks stay local.

```powershell
npm run validate
npm run native:check
npm run verify:android
```

Input novels, generated assets/database, APK output and dependencies stay on disk but are not tracked by Git. After cloning, provide your JSON and run `npm run prepare:book` before starting/building. Git root is `C:\Truyen`, with source from all three projects.

Cảnh giới Đế Bá: nút “Cảnh giới” ở thư viện/thông tin truyện và màn hình đọc. Hỗ trợ chọn giới vực, tìm tên không dấu, tiểu cảnh và nguồn đối chiếu. Bản JSON nhỏ đóng gói được đọc trước; API từ database dùng khi thiếu dữ liệu cục bộ. Dữ liệu gốc ở `../TruyenBackend/data/cultivation/de-ba.json`, được sao chép khi chuẩn bị nội dung.
