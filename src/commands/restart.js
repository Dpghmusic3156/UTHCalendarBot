const { isDev } = require('../utils/auth');

module.exports = (bot) => {
    bot.command('restart', async (ctx) => {
        if (!isDev(ctx.from.id)) {
            return ctx.reply('🔒 Lệnh này yêu cầu xác thực Dev.\nDùng /dev <devcode> để mở khóa.');
        }

        await ctx.reply('🔄 Bot đang restart...');
        console.log('🔄 Restart requested by dev:', ctx.from.id);

        setTimeout(() => {
            process.exit(0); // PM2 will auto-restart
        }, 1000);
    });
};
