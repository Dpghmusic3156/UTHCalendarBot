const { isDev } = require('../utils/auth');

module.exports = (bot) => {
    bot.help((ctx) => {
        let text =
            `📖 *Danh sách lệnh:*\n\n` +
            `🔐 /login MSSV mật\\_khẩu — Đăng ký tài khoản Portal\n` +
            `📅 /calendar — Xem lịch tuần hiện tại\n` +
            `📅 /calendar +1 — Xem lịch tuần sau\n` +
            `📅 /calendar +2 — Xem lịch 2 tuần nữa\n` +
            `🛠 /dev — Chế độ Dev\n` +
            `❓ /help — Xem hướng dẫn\n`;

        if (isDev(ctx.from.id)) {
            text += `\n🔧 *Lệnh Dev:*\n` +
                `⏰ /settime — Đặt giờ auto-login\n` +
                `🔄 /restart — Restart bot\n`;
        }

        text += `\n⚠️ Khi bot đăng nhập portal, session trên thiết bị khác sẽ bị đá ra.`;

        return ctx.reply(text, { parse_mode: 'Markdown' });
    });
};
