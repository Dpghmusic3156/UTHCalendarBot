const { isDev } = require('../utils/auth');
const { getUser, setUser, DEFAULT_CRON_HOUR } = require('../utils/config');

module.exports = (bot) => {
    bot.command('settime', async (ctx) => {
        if (!isDev(ctx.from.id)) {
            return ctx.reply('🔒 Lệnh này yêu cầu xác thực Dev.\nDùng /dev để mở khóa.');
        }

        const text = ctx.message.text.split(' ').slice(1).join(' ').trim();

        if (text === '') {
            const user = getUser(ctx.from.id);
            const cronHour = user.cronHour !== undefined && user.cronHour !== null
                ? user.cronHour
                : DEFAULT_CRON_HOUR;
            return ctx.reply(
                `⏰ Giờ auto-login hiện tại: *${cronHour}:00 UTC+7*\n` +
                `_(Mặc định: ${DEFAULT_CRON_HOUR}:00)_\n\n` +
                `Đổi giờ: /settime 0-23\n` +
                `Ví dụ: /settime 6 → 6:00 AM`,
                { parse_mode: 'Markdown' }
            );
        }

        const hour = parseInt(text, 10);

        if (isNaN(hour) || hour < 0 || hour > 23) {
            return ctx.reply('⚠️ Giờ không hợp lệ. Giá trị 0-23.');
        }

        setUser(ctx.from.id, { cronHour: hour });

        return ctx.reply(
            `✅ Đã đổi giờ auto-login thành *${hour}:00 UTC+7*`,
            { parse_mode: 'Markdown' }
        );
    });
};
