# Bộ truyện Mộc

`C:\Truyen` is the shared Git root. Its top level contains directories only: TruyenBackend, TruyenReader, TruyenWeb, TaiLieu and the hidden .git folder.

- Backend/API/database/Docker: `TruyenBackend`; start `CHAY_DOCKER.bat` with Docker Desktop open. Web: http://localhost:5178; API: http://localhost:8000/docs. Stop with `DUNG_DOCKER.bat` to preserve the database volume.
- App/Expo/APK: `TruyenReader`; start `CHAY_THU.bat` or build with `BUILD_APK.bat`.
- Web/Vite: `TruyenWeb`; `CHAY_WEB.bat` and `CHAY_WEB_DEV.bat` start the standalone JSON reader without backend or Docker.
- Every project has its own README, AGENTS.md and folder-local `.agents/skills`. No global backend skill applies to frontend work.

Git tracks source, locks, configuration examples, branding, rules and tests across all three projects. Secret env files, original novels, generated content, dependencies, cache and build output remain untracked. Existing story files and the Docker database are preserved. A fresh clone needs a local story JSON and the content preparation commands documented in each project.

The repository currently has no commits or remote configured. Open `C:\Truyen` in the Git interface to see all projects. Configure a real remote URL before pushing; do not invent one. No GitHub upload is performed by cleanup.

Đọc truyện và tra cảnh giới ưu tiên dữ liệu JSON đã chuẩn bị; không cần API hoặc đăng nhập. App đọc bộ dữ liệu cục bộ được tạo từ JSON. Khi backend có kết nối, chức năng tài khoản và đồng bộ tiến độ tiếp tục hoạt động.
