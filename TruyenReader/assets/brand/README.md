# Nhận diện Mộc

Biểu tượng sách mở và hai chiếc lá, tự vẽ bằng SVG, màu xanh rừng / giấy ngà. Không dùng hình stock hoặc logo của bên thứ ba.

- `icon.png`: 1024×1024, nền kín, icon cài đặt Android/iOS.
- `adaptive-foreground.png`: 1024×1024, nền trong suốt, biểu tượng nằm trong vùng an toàn.
- `adaptive-monochrome.png`: 1024×1024, mặt nạ trắng trong suốt cho themed icon Android.
- `logo.png`, `logo-dark.png`: logo trong suốt cho màn hình khởi động sáng/tối.
- `logo-header.png`: dùng trong thanh tiêu đề app.
- `favicon.png`: 64×64.
- `logo-source.svg`, `icon-source.svg`: nguồn vector.
- `brand-preview.png`: ảnh xem trước bộ nhận diện.

Các tài nguyên đã được tham chiếu trong app.json và App.tsx. Chạy `npm run brand:generate` nếu cần xuất lại từ mã vector tại scripts/create-brand.mjs.

Icon cài đặt và splash native cần build APK mới; Expo Go không thể mô phỏng đầy đủ splash của bản release.
