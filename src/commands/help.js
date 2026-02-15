module.exports = (bot) => {
    bot.help((ctx) => {
        return ctx.reply(
            `📖 *Danh sách lệnh:*\n\n` +
            `📅 /calendar — Chụp lịch học từ Portal UTH\n` +
            `❓ /help — Xem hướng dẫn\n\n` +
            `⚠️ *Lưu ý:* Bot sẽ đăng nhập portal, nếu bạn đang online trên portal thì session sẽ bị đá ra.`,
            { parse_mode: 'Markdown' }
        );
    });
};
