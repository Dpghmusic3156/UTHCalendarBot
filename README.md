# Portal UTH Bot (Zalo & Telegram) 🤖📅

Bot tự động đăng nhập Portal UTH (ĐH Giao Thông Vận Tải TP.HCM) để lấy Lịch Học và gửi thông báo qua Zalo / Telegram.

## 🚀 Tính Năng

| Tính năng        |                 Zalo Bot                 |           Telegram Bot            |
| :--------------- | :--------------------------------------: | :-------------------------------: |
| **Đăng nhập**    |      `/login` (Tự động lưu Session)      |             `/login`              |
| **Xem Lịch Học** |         `/calendar` (Ảnh + Text)         |     `/calendar` (Ảnh Full HD)     |
| **Xem Tuần Sau** |    `/calendar +1`, `/calendar +2`...     | `/calendar +1`, `/calendar +2`... |
| **Định dạng**    | Ảnh (qua Proxy `tmpfiles`) + Text backup |        Ảnh (Gửi trực tiếp)        |
| **Bảo mật**      |       Check MSSV (số), ẩn Password       |     Check MSSV, xóa msg Pass      |
| **Auto-Login**   |          Tự động refresh cookie          |      Tự động refresh cookie       |

## 🛠️ Cài Đặt (Setup)

### 1. Clone & Install

```bash
git clone https://github.com/your-repo/portal-uth-bot.git
cd portal-uth-bot
npm install
```

### 2. Cấu hình `.env`

Tạo file `.env` từ `.env.example`:

```ini
# --- Zalo Configuration ---
ZALO_BOT_TOKEN=your_zalo_token
ZALO_OA_ID=your_oa_id

# --- Telegram Configuration ---
BOT_TOKEN=your_telegram_bot_token

# --- Portal Credentials (Optional helper) ---
PORTAL_USER=
PORTAL_PASS=
```

### 3. Chạy Server

```bash
# Chạy chế độ development
npm start

# Chạy production (khuyên dùng PM2)
npm install -g pm2
pm2 start src/bot.js --name "uth-bot"
```

## 📖 Hướng Dẫn Sử Dụng

### Zalo

1.  **Quan tâm**.
2.  Gõ `/login` -> Hệ thống sẽ hỏi **MSSV** (chỉ nhập số) -> **Mật khẩu**.
3.  Sau khi đăng nhập thành công, gõ `/calendar` để xem lịch tuần này.
4.  Gõ `/calendar +1` để xem lịch tuần sau.

### Telegram

1.  Start bot `/start`.
2.  Gõ `/login <MSSV> <Mật khẩu>` (Tin nhắn sẽ tự xóa để bảo mật).
3.  Gõ `/calendar` hoặc `/calendar +1` để nhận ảnh lịch học.

## ⚙️ Cơ Chế Hoạt Động

- **Scraper:** Sử dụng `Puppeteer` để điều khiển Chrome Headless, đăng nhập vào `portal.ut.edu.vn`.
- **Zalo Photo:** Do cơ chế API, ảnh được upload lên `tmpfiles.org` trước khi gửi link sang Zalo.
- **Telegram Photo:** Gửi trực tiếp Buffer từ RAM (nhanh & bảo mật hơn).
- **Cookies:** Cookie được lưu tại `data/cookies/`, tự động gia hạn khi hết hạn.

## ⚠️ Lưu ý

- Không chia sẻ file `data/cookies/*.json` cho người lạ.
- Nên chạy trên VPS (Ubuntu/Windows) để bot online 24/7.
- Nếu Zalo báo lỗi `Upload failed`, hãy kiểm tra kết nối tới `tmpfiles.org`.
