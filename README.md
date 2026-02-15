# 🤖 Portal UTH Telegram Bot

Bot Telegram tự động chụp lịch học từ [portal.ut.edu.vn](https://portal.ut.edu.vn) và gửi ảnh về cho bạn. Hỗ trợ **nhiều người dùng**, mỗi người tài khoản portal riêng.

## ✨ Tính năng

- 🔐 **Multi-user** — Mỗi user tự đăng ký tài khoản Portal qua `/login`
- 📅 **Lịch học** — Chụp lịch học cá nhân qua `/calendar`
- ✅ **Xác thực** — Kiểm tra tài khoản thật trước khi lưu, hiển thị tên sinh viên
- ⏰ **Auto-login** — Tự động đăng nhập lúc 4:00 AM UTC+7 mỗi ngày (tất cả user)
- 🛠 **Dev mode** — Lệnh ẩn `/dev`, `/settime`, `/restart` cho admin
- 📢 **Thông báo Dev** — Dev nhận thông báo khi có user đăng nhập mới hoặc chụp lịch
- ⚡ Tối ưu tốc độ: persistent browser, cookie reuse, resource blocking
- 🔄 Tự login lại khi session hết hạn
- 🛡 Queue requests tránh xung đột
- 🔁 PM2 auto-restart 24/7

## 📋 Danh sách lệnh

### Lệnh công khai

| Lệnh                   | Mô tả                                      |
| ---------------------- | ------------------------------------------ |
| `/start`               | Giới thiệu bot                             |
| `/login MSSV mật_khẩu` | Đăng ký tài khoản Portal (tự xóa tin nhắn) |
| `/calendar`            | Chụp lịch học                              |
| `/help`                | Xem hướng dẫn                              |

### Lệnh Dev (ẩn, cần `/dev` xác thực)

| Lệnh             | Mô tả                                 |
| ---------------- | ------------------------------------- |
| `/dev <devcode>` | Xác thực chế độ Dev                   |
| `/dev off`       | Tắt chế độ Dev                        |
| `/settime <giờ>` | Đổi giờ auto-login (0-23, mặc định 4) |
| `/restart`       | Restart bot (cần PM2)                 |

## 📁 Cấu trúc project

```
portal-uth-telegram-bot/
├── src/
│   ├── bot.js              # Entry point, cron scheduler
│   ├── commands/
│   │   ├── start.js        # Welcome message
│   │   ├── help.js         # Danh sách lệnh (dynamic theo dev mode)
│   │   ├── login.js        # Đăng ký + xác thực tài khoản Portal
│   │   ├── calendar.js     # Chụp lịch học
│   │   ├── settime.js      # Đổi giờ auto-login (dev-only)
│   │   ├── dev.js          # Xác thực / bật tắt dev mode
│   │   └── restart.js      # Restart bot (dev-only)
│   ├── scraper/
│   │   └── portal.js       # Puppeteer scraper (multi-user)
│   └── utils/
│       ├── config.js       # Per-user config (credentials, settings)
│       ├── auth.js         # Dev auth (persistent)
│       └── notify.js       # Thông báo cho dev users
├── data/                   # Auto-generated, nằm trong .gitignore
│   ├── config.json         # User settings & credentials
│   ├── cookies/            # Per-user cookies (cookies/<userId>.json)
│   └── screenshots/        # Per-user screenshots
├── ecosystem.config.js     # PM2 config
├── .env.example
├── .gitignore
└── package.json
```

## 🚀 Cài đặt

### 1. Clone & cài dependencies

```bash
git clone <repo-url>
cd portal-uth-telegram-bot
npm install
```

### 2. Cấu hình

```bash
cp .env.example .env
```

Sửa file `.env`:

```env
BOT_TOKEN=your_telegram_bot_token
DEV_CODE=your_secret_dev_code
```

> 💡 Lấy `BOT_TOKEN` bằng cách chat với [@BotFather](https://t.me/BotFather) trên Telegram
>
> ℹ️ Tài khoản Portal **không cần cấu hình ở đây** — mỗi user tự đăng ký qua `/login`

### 3. Chạy

```bash
# Development
npm start

# Production (PM2)
npm run pm2:start
```

## 🖥 Deploy lên VPS (chạy 24/7)

### Bước 1: Cài đặt môi trường

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y nodejs npm

# Cài Chromium cho Puppeteer
sudo apt install -y chromium-browser

# Cài PM2 global
sudo npm install -g pm2
```

### Bước 2: Upload & chạy

```bash
cd /home/user/portal-uth-bot
npm install
cp .env.example .env
nano .env  # điền BOT_TOKEN và DEV_CODE

# Khởi động
npm run pm2:start

# PM2 tự khởi động khi reboot
pm2 startup
pm2 save
```

### Các lệnh PM2

```bash
pm2 status                 # Xem trạng thái
pm2 logs portal-uth-bot    # Xem logs
pm2 restart portal-uth-bot # Restart
pm2 stop portal-uth-bot    # Dừng
pm2 monit                  # Monitor CPU/RAM
```

## 🔒 Bảo mật

- Tin nhắn `/login` chứa mật khẩu **tự động bị xóa** khỏi chat
- Mật khẩu lưu trong `data/config.json` — **bảo mật file này trên VPS**
- Dev mode yêu cầu `DEV_CODE` từ `.env`, persistent qua restart
- Thư mục `data/` nằm trong `.gitignore`

## ⚠️ Lưu ý

- Portal UTH chỉ cho phép **1 session/tài khoản**. Khi bot login, session trên thiết bị khác sẽ bị đá ra.
- Mỗi user có **cookies riêng**, bot chỉ login lại khi session hết hạn.
- Auto-login mặc định lúc **4:00 AM UTC+7** cho tất cả user, dev có thể đổi qua `/settime`.
