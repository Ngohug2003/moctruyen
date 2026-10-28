# Deploy backend lên EC2 bằng GitHub Actions

Workflow `.github/workflows/backend.yml` chạy khi backend/workflow thay đổi trên `main`, khi mở pull request và khi bấm Run workflow. CI build backend rồi chạy pytest với PostgreSQL riêng. Deploy chỉ chạy sau CI thành công trên main và khi repository variable `ENABLE_EC2_DEPLOY=true`.

Web Vercel tiếp tục deploy qua tích hợp Git hiện tại. Workflow này không build/phát hành APK.

## Thiết lập một lần trên VPS

Đăng nhập bằng ubuntu. Repo phải ở `/home/ubuntu/moctruyen`, nhánh main, có quyền fetch origin không cần nhập mật khẩu. Docker Compose và Caddy đang chạy; file `TruyenBackend/.docker.env` chứa mật khẩu database hiện tại. Giữ nguyên file và volume PostgreSQL.

Tạo khóa riêng cho Actions (chỉ chạy một lần, không ghi đè khóa đã tồn tại):

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
ssh-keygen -t ed25519 -f ~/.ssh/moc_actions -N '' -C moc-github-actions
cat ~/.ssh/moc_actions.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

Lấy private key để nhập trực tiếp vào GitHub secret `EC2_SSH_KEY`:

```bash
cat ~/.ssh/moc_actions
```

Lấy host key để nhập vào GitHub secret `EC2_KNOWN_HOSTS` (IP phải khớp EC2_HOST):

```bash
awk '{print "3.104.65.209 " $1 " " $2}' /etc/ssh/ssh_host_ed25519_key.pub
```

Không đưa private key vào Git hoặc gửi vào chat. Security Group cần cho GitHub runner truy cập SSH cổng 22; rule chỉ cho My IP sẽ chặn runner. HTTPS 443 và HTTP 80 vẫn mở cho Caddy.

## Thiết lập GitHub

Mở repository → Settings → Secrets and variables → Actions:

- Secrets: thêm `EC2_SSH_KEY` và `EC2_KNOWN_HOSTS` bằng hai giá trị trên.
- Variables: thêm `ENABLE_EC2_DEPLOY` với giá trị `true` sau khi secrets và SSH sẵn sàng.
- Tùy chọn: `EC2_HOST` mặc định `3.104.65.209`, `EC2_USER` mặc định `ubuntu`.

Vào Actions → Backend CI and deploy → Run workflow → main. Theo dõi cả job test và deploy. Những lần sau push thay đổi backend lên main sẽ tự chạy. Nếu chỉ sửa web/app, backend không cần deploy.

## Cấu hình production

`docker/production.env` chứa API_PORT và danh sách CORS, được đọc sau `.docker.env` nên thay thế cấu hình CORS cũ. Chỉnh file này và push khi thêm tên miền web. File này không chứa mật khẩu. Không cần sao chép CORS vào `.docker.env` nữa.

API chỉ bind `127.0.0.1:8000`; Caddy dùng host network vẫn truy cập được. URL công khai là `https://api.hungworks.io.vn`. Không dùng URL IP:8000 từ Internet sau deploy.

Script build khi API cũ vẫn chạy, chạy migration, rồi tạo lại riêng API và đợi healthy tối đa 300 giây. Caddy/database volume không bị xóa. Có khoảng gián đoạn ngắn khi tạo lại API; đây không phải deploy không gián đoạn. Migration đã áp dụng không tự rollback nếu phiên bản mới lỗi; kiểm tra log Actions và API trước khi xử lý. Startup hiện tại của image nhập dữ liệu đóng gói theo Dockerfile.

Deploy thủ công cùng cấu hình (sau khi pull main):

```bash
cd /home/ubuntu/moctruyen
bash TruyenBackend/scripts/deploy.sh "$(git rev-parse HEAD)"
```

Workflow deploy commit đã test, từ chối file tracked bị sửa trên VPS, cập nhật bằng fast-forward và bỏ qua commit cũ nếu main đã có commit mới hơn. Không chạy git reset hoặc tự ghi đè chỉnh sửa trên VPS.

Xem trạng thái với đúng cấu hình production:

```bash
cd /home/ubuntu/moctruyen/TruyenBackend
docker compose --env-file .docker.env --env-file docker/production.env ps
docker compose --env-file .docker.env --env-file docker/production.env logs --tail 80 api
curl -f https://api.hungworks.io.vn/ready
```
