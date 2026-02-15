# 🤖 Portal UTH Telegram Bot

Bot Telegram tự động chụp lịch học từ [portal.ut.edu.vn](https://portal.ut.edu.vn) và gửi ảnh về cho bạn. Hỗ trợ **nhiều người dùng**, mỗi người dùng tài khoản portal riêng.

## ✨ Tính năng

- � **Multi-user** — Mỗi user tự đăng ký tài khoản Portal riêng
- �📅 `/calendar` — Chụp lịch học cá nhân
- ⏰ `/settime` — Đặt giờ auto-login hàng ngày (per-user)
- 🛠 `/dev` — Chế độ dev (bật/tắt, bảo vệ bằng devcode)
- ⚡ Tối ưu tốc độ: persistent browser, cookie reuse, resource blocking
- 🔄 Tự login lại khi session hết hạn
- 🛡 Queue requests tránh xung đột
- 🔁 PM2 auto-restart 24/7

## � Danh sách lệnh

| Lệnh                       | Mô tả                                      |
| -------------------------- | ------------------------------------------ |
| `/start`                   | Giới thiệu bot                             |
| `/login <MSSV> <mật_khẩu>` | Đăng ký tài khoản Portal (tự xóa tin nhắn) |
| `/calendar`                | Chụp lịch học                              |
| `/settime <giờ>`           | Đặt giờ auto-login (0-23, UTC+7)           |
| `/settime off`             | Tắt auto-login                             |
| `/dev <devcode>`           | Xác thực chế độ Dev                        |
| `/dev off`                 | Tắt chế độ Dev                             |
| `/restart`                 | Restart bot _(yêu cầu Dev)_                |
| `/help`                    | Xem hướng dẫn                              |

## 📁 Cấu trúc project

```
portal-uth-telegram-bot/
├── src/
│   ├── bot.js              # Entry point, cron scheduler
│   ├── commands/
│   │   ├── start.js        # Welcome message
│   │   ├── help.js         # Danh sách lệnh
│   │   ├── login.js        # Đăng ký tài khoản Portal
│   │   ├── calendar.js     # Chụp lịch học
│   │   ├── settime.js      # Đặt giờ auto-login
│   │   ├── dev.js          # Xác thực dev
│   │   └── restart.js      # Restart bot
│   ├── scraper/
│   │   └── portal.js       # Puppeteer scraper (multi-user)
│   └── utils/
│       ├── config.js       # Per-user config (credentials, settings)
│       └── auth.js         # Dev auth (persistent)
├── data/                   # Auto-generated
│   ├── config.json         # User settings & credentials
│   ├── cookies/            # Per-user cookies
│   └── screenshots/        # Per-user screenshots
├── ecosystem.config.js     # PM2 config
├── .env.example
├── .gitignore
└── package.json
```

## �🚀 Cài đặt

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
> ℹ️ Tài khoản Portal **không cần cấu hình ở đây** — mỗi user tự đăng ký qua lệnh `/login`

### 3. Chạy

```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

## 🖥 Deploy lên VPS (chạy 24/7)

### Bước 1: Cài đặt môi trường

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y nodejs npm

# Cài Chromium cho Puppeteer
sudo apt install -y chromium-browser
# hoặc để Puppeteer tự tải:
# npx puppeteer browsers install chrome

# Cài PM2 global
sudo npm install -g pm2
```

### Bước 2: Upload code lên VPS

```bash
# Từ máy local, dùng scp
scp -r ./ user@your-vps-ip:/home/user/portal-uth-bot/

# Hoặc dùng git
ssh user@your-vps-ip
git clone <repo-url> /home/user/portal-uth-bot
```

### Bước 3: Cài đặt & chạy

```bash
cd /home/user/portal-uth-bot
npm install
cp .env.example .env
nano .env  # điền BOT_TOKEN và DEV_CODE

# Khởi động với PM2
npm run pm2:start

# Kiểm tra status
npm run pm2:status

# Xem logs
npm run pm2:logs
```

### Bước 4: PM2 tự khởi động khi VPS reboot

```bash
pm2 startup
pm2 save
```

### Các lệnh PM2 hữu ích

```bash
pm2 status                 # Xem trạng thái
pm2 logs portal-uth-bot    # Xem logs realtime
pm2 restart portal-uth-bot # Restart bot
pm2 stop portal-uth-bot    # Dừng bot
pm2 monit                  # Monitor CPU/RAM
```

## ⚠️ Lưu ý

- Portal UTH chỉ cho phép **1 session**. Khi bot login cho user A, session của user A trên thiết bị khác sẽ bị đá ra.
- Mỗi user có **cookies riêng**, bot chỉ login lại khi session hết hạn.
- Mật khẩu portal được lưu trong `data/config.json` — **bảo mật file này trên VPS**.
- Tin nhắn chứa `/login` sẽ **tự động bị xóa** khỏi chat để bảo vệ mật khẩu.
- Lệnh `/restart` chỉ hoạt động khi đã xác thực `/dev`.
