
require('dotenv').config();

const { Telegraf } = require('telegraf');
const cron = require('node-cron');
const portalScraper = require('./scraper/portal');
const { getSubscribedUsers } = require('./utils/config');

if (!process.env.BOT_TOKEN) {
    console.error('❌ BOT_TOKEN is required.');
    process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN);

// Logging middleware
bot.use(async (ctx, next) => {
    const start = Date.now();
    const user = ctx.from
        ? `${ctx.from.first_name || ''} (${ctx.from.id})`
        : 'unknown';
    console.log(`📨 [${ctx.updateType}] from ${user}`);
    await next();
    console.log(`   ⏱ ${Date.now() - start}ms`);
});

bot.catch((err, ctx) => {
    console.error('❌ Bot error:', err);
    ctx.reply('❌ Đã xảy ra lỗi, vui lòng thử lại.').catch(() => { });
});

// Register commands
require('./commands/start')(bot);
require('./commands/help')(bot);
require('./commands/login')(bot);
require('./commands/calendar')(bot);
require('./commands/dev')(bot);
require('./commands/settime')(bot);
require('./commands/restart')(bot);

async function main() {
    console.log('🚀 Starting bot...');
    await portalScraper.init();

    await bot.telegram.setMyCommands([
        { command: 'calendar', description: '📅 Chụp lịch học' },
        { command: 'login', description: '🔐 Đăng ký tài khoản Portal' },
        { command: 'help', description: '❓ Xem hướng dẫn' },
    ]);
    console.log('📋 Menu commands registered');

    await bot.launch();
    console.log('✅ Bot is running!');

    // Hourly cron: check per-user auto-login schedules
    cron.schedule('0 * * * *', async () => {
        const now = new Date();
        const utc7Hour = (now.getUTCHours() + 7) % 24;
        const subscribers = getSubscribedUsers().filter(u => u.cronHour === utc7Hour);

        if (subscribers.length === 0) return;

        console.log(`⏰ [Cron] ${utc7Hour}:00 UTC+7 — Auto-login for ${subscribers.length} user(s)`);

        for (const { chatId } of subscribers) {
            try {
                await portalScraper.refreshSession(chatId);
                console.log(`✅ [Cron] [${chatId}] Cookies refreshed`);

                await bot.telegram.sendMessage(chatId,
                    `⏰ *Auto-login ${utc7Hour}:00 UTC+7*\n✅ Đăng nhập thành công, cookies đã làm mới.`,
                    { parse_mode: 'Markdown' }
                ).catch(() => { });
            } catch (err) {
                console.error(`❌ [Cron] [${chatId}] Failed:`, err.message);

                await bot.telegram.sendMessage(chatId,
                    `⏰ *Auto-login ${utc7Hour}:00 UTC+7*\n❌ Thất bại: ${err.message}`,
                    { parse_mode: 'Markdown' }
                ).catch(() => { });
            }
        }
    }, { timezone: 'UTC' });

    console.log('⏰ Hourly cron check active');
}

main().catch((err) => {
    console.error('❌ Failed to start:', err);
    process.exit(1);
});

async function shutdown(signal) {
    console.log(`\n🛑 ${signal} received. Shutting down...`);
    bot.stop(signal);
    await portalScraper.close();
    process.exit(0);
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
