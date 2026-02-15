
require('dotenv').config();

const { Telegraf } = require('telegraf');
const portalScraper = require('./scraper/portal');

// Validate required env vars
if (!process.env.BOT_TOKEN) {
    console.error('❌ BOT_TOKEN is required. Copy .env.example to .env and fill in your token.');
    process.exit(1);
}

// Create bot instance
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

// Error handler
bot.catch((err, ctx) => {
    console.error('❌ Bot error:', err);
    ctx.reply('❌ Đã xảy ra lỗi, vui lòng thử lại.').catch(() => { });
});

// Register commands
require('./commands/start')(bot);
require('./commands/help')(bot);
require('./commands/calendar')(bot);

// Launch bot
async function main() {
    // Pre-launch browser for faster first request
    console.log('🚀 Starting bot...');
    await portalScraper.init();

    await bot.launch();
    console.log('✅ Bot is running!');
}

main().catch((err) => {
    console.error('❌ Failed to start:', err);
    process.exit(1);
});

// Graceful shutdown
async function shutdown(signal) {
    console.log(`\n🛑 ${signal} received. Shutting down...`);
    bot.stop(signal);
    await portalScraper.close();
    process.exit(0);
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
