const { isDev, addDev, removeDev } = require('../utils/auth');

module.exports = (bot) => {
    bot.command('dev', async (ctx) => {
        const code = ctx.message.text.split(' ').slice(1).join(' ').trim();
        const devCode = process.env.DEV_CODE;

        if (!devCode) {
            return ctx.reply('⚠️ DEV_CODE chưa được cấu hình.');
        }

        // Toggle off
        if (code.toLowerCase() === 'off' && isDev(ctx.from.id)) {
            removeDev(ctx.from.id);
            return ctx.reply('🔒 Đã tắt chế độ Dev.');
        }

        // No args — show status
        if (!code) {
            if (isDev(ctx.from.id)) {
                return ctx.reply(
                    `🔓 *Chế độ Dev: BẬT*\n\n` +
                    `🛠 Lệnh Dev:\n` +
                    `⏰ /settime — Đổi giờ auto-login\n` +
                    `🔄 /restart — Restart bot\n` +
                    `🔒 /dev off — Tắt chế độ Dev`,
                    { parse_mode: 'Markdown' }
                );
            }
            return ctx.reply('🔐 Nhập mã: /dev <devcode>');
        }

        // Authenticate
        if (code === devCode) {
            addDev(ctx.from.id);
            await ctx.deleteMessage().catch(() => { });
            return ctx.reply(
                `🔓 *Xác thực thành công!*\n\n` +
                `🛠 Lệnh Dev đã mở khóa:\n` +
                `⏰ /settime — Đổi giờ auto-login\n` +
                `🔄 /restart — Restart bot\n` +
                `🔒 /dev off — Tắt chế độ Dev`,
                { parse_mode: 'Markdown' }
            );
        }

        await ctx.deleteMessage().catch(() => { });
        return ctx.reply('❌ Mã không đúng.');
    });
};
