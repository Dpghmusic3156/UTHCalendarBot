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

        const rawText = ctx.message.text || '';
        const args = rawText.split(' ').slice(1);
        let weekOffset = 0;

        if (args.length > 0) {
            const num = parseInt(args[0].replace('+', ''), 10);
            if (!isNaN(num)) weekOffset = num;
        }

        const msgText = weekOffset === 0
            ? '⏳ Đang chụp lịch học (Tuần này)...'
            : `⏳ Đang chụp lịch học (+${weekOffset} tuần)...`;

        const statusMsg = await ctx.reply(msgText);

        try {
            const startTime = Date.now();
            const screenshot = await portalScraper.captureCalendar(userId, weekOffset);
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

            // Save screenshot per user (optional, but good for debug)
            if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
            const screenshotPath = path.join(SCREENSHOT_DIR, `${userId}_${Date.now()}.png`);
            fs.writeFileSync(screenshotPath, screenshot);

            const caption = weekOffset === 0
                ? `📅 Lịch học: Tuần hiện tại\n⏱ ${elapsed}s`
                : `📅 Lịch học: Tuần +${weekOffset}\n⏱ ${elapsed}s`;

            await ctx.replyWithPhoto(
                { source: screenshotPath },
                { caption: caption }
            );

            // Cleanup
            try { fs.unlinkSync(screenshotPath); } catch (e) { }

            await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => { });

            // Notify devs
            // const name = ctx.from.first_name || '';
            // const userConfig = getUser(userId);
            // const displayName = userConfig.displayName || creds.username;
            // await notifyDevs(bot, `📅 *Lịch học Telegram*\n👤 ${name} (${displayName})\n⏱ ${elapsed}s`, userId);

        } catch (err) {
            console.error(`❌ [${userId}] Calendar capture failed:`, err);
            await ctx.telegram.editMessageText(
                ctx.chat.id,
                statusMsg.message_id,
                undefined,
                `❌ Lỗi: ${err.message}`
            ).catch(() => { });
        }
    });
};
