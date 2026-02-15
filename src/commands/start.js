module.exports = (bot) => {
    bot.start((ctx) => {
        const name = ctx.from.first_name || 'bạn';
        return ctx.reply(
            `👋 Chào mừng *${name}* đến với LichHocBot!\n\n` +
            `🎓 Bot giúp bạn xem lịch học từ Portal UTH nhanh chóng.\n\n` +
            `🔐 *Bắt đầu:*\n` +
            `1️⃣ /login <MSSV> <mật\\_khẩu> — Đăng nhập tài khoản\n` +
            `2️⃣ /calendar — Chụp lịch học\n\n` +
            `⚠️ *Lưu ý:* Khi bot đăng nhập, session trên thiết bị khác sẽ bị đá ra.\n\n` +
            `Gõ /help để xem tất cả lệnh.`,
            { parse_mode: 'Markdown' }
        );
    });
};
