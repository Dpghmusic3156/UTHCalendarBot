const fs = require('fs');
const path = require('path');
const portalScraper = require('../scraper/portal');
const { getPortalCredentials, getUser } = require('../utils/config');
const { notifyDevs } = require('../utils/notify');

const SCREENSHOT_DIR = path.join(__dirname, '..', '..', 'data', 'screenshots');

module.exports = (bot) => {
    bot.command('calendar', async (ctx) => {
        const userId = ctx.from.id;

        // Check if user has registered portal credentials
        const creds = getPortalCredentials(userId);
        if (!creds) {
            return ctx.reply(
                `⚠️ Bạn chưa đăng nhập tài khoản Portal.\n\n` +
                `Dùng /login <MSSV> <mật_khẩu> để đăng nhập.`
            );
        }

        const statusMsg = await ctx.reply('⏳ Đang chụp lịch học, vui lòng chờ...');

        try {
            const startTime = Date.now();
            const screenshot = await portalScraper.captureCalendar(userId);
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

            // Save screenshot per user
            if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
            const screenshotPath = path.join(SCREENSHOT_DIR, `${userId}.png`);
            fs.writeFileSync(screenshotPath, screenshot);

            await ctx.replyWithPhoto(
                { source: screenshotPath },
                { caption: `📅 Lịch học Portal UTH\n⏱ Thời gian: ${elapsed}s` }
            );

            await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => { });

            // Notify devs
            const name = ctx.from.first_name || '';
            const userConfig = getUser(userId);
            const displayName = userConfig.displayName || creds.username;
            await notifyDevs(bot, `📅 *Lịch học*\n👤 ${name} (${displayName})\n⏱ ${elapsed}s`, userId);
        } catch (err) {
            console.error(`❌ [${userId}] Calendar capture failed:`, err);

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
