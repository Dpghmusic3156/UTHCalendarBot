module.exports = (bot) => {
    bot.start((ctx) => {
        const name = ctx.from.first_name || 'bạn';
        return ctx.reply(
            `👋 Xin chào ${name}!\n\n` +
            `Tôi là bot chụp lịch học từ Portal UTH.\n\n` +
            `📅 /calendar — Chụp lịch học\n` +
            `❓ /help — Xem hướng dẫn`
        );
    });
};
