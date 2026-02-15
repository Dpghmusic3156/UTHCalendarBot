# 🤖 Portal UTH Telegram Bot

Bot Telegram tự động chụp lịch học từ [portal.ut.edu.vn](https://portal.ut.edu.vn) và gửi ảnh về cho bạn.

## ✨ Tính năng

- 📅 `/calendar` — Chụp lịch học từ Portal UTH
- ⚡ Tối ưu tốc độ: persistent browser, cookie reuse, resource blocking
- 🔄 Tự login lại khi session hết hạn
- 🛡 Queue requests tránh xung đột
- 🔁 PM2 auto-restart 24/7

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
PORTAL_USERNAME=your_student_id
PORTAL_PASSWORD=your_password
```

> 💡 Lấy BOT_TOKEN bằng cách chat với [@BotFather](https://t.me/BotFather) trên Telegram

### 3. Chạy

```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

## 🖥 Deploy lên VPS (chạy 24/7)

### Bước 1: Cài đặt môi trường trên VPS

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

### Bước 3: Cài đặt & chạy trên VPS

```bash
cd /home/user/portal-uth-bot
npm install
cp .env.example .env
nano .env  # điền thông tin

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
pm2 status             # Xem trạng thái
pm2 logs portal-uth-bot  # Xem logs realtime
pm2 restart portal-uth-bot # Restart bot
pm2 stop portal-uth-bot    # Dừng bot
pm2 monit              # Monitor CPU/RAM
```

## ⚠️ Lưu ý

- Portal UTH chỉ cho phép **1 session**. Khi bot login, session trên thiết bị khác sẽ bị đá ra.
- Bot sẽ lưu cookies để **tái sử dụng session**, chỉ login lại khi bị đá hoặc hết hạn.
- Lần đầu chạy `/calendar` sẽ chậm hơn (cần login). Các lần sau nhanh hơn nhờ cookie.
