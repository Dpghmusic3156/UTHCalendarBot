const fs = require('fs');
const path = require('path');
const portalScraper = require('../scraper/portal');

const SCREENSHOT_PATH = path.join(__dirname, '..', '..', 'data', 'calendar.png');

module.exports = (bot) => {
    bot.command('calendar', async (ctx) => {
        const statusMsg = await ctx.reply('⏳ Đang chụp lịch học, vui lòng chờ...');

        try {
            const startTime = Date.now();
            const screenshot = await portalScraper.captureCalendar();
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

            // Save screenshot to file first
            const dir = path.dirname(SCREENSHOT_PATH);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(SCREENSHOT_PATH, screenshot);

            // Send screenshot as photo from file
            await ctx.replyWithPhoto(
                { source: SCREENSHOT_PATH },
                { caption: `📅 Lịch học Portal UTH\n⏱ Thời gian: ${elapsed}s` }
            );

            // Delete the "loading" message
            await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => { });
        } catch (err) {
            console.error('❌ Calendar capture failed:', err);

            await ctx.telegram
                .editMessageText(
                    ctx.chat.id,
                    statusMsg.message_id,
                    undefined,
                    `❌ Lỗi: ${err.message}\n\nVui lòng thử lại sau.`
                )
                .catch(() => { });
        }
    });
};
