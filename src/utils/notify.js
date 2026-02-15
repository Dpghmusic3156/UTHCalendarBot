const { loadConfig } = require('./config');

/**
 * Notify all dev users about an event
 * @param {object} bot - Telegraf bot instance
 * @param {string} message - Message to send (Markdown)
 * @param {number} [excludeUserId] - Skip this user (the one who triggered the event)
 */
async function notifyDevs(bot, message, excludeUserId) {
    const config = loadConfig();
    if (!config.users) return;

    for (const [userId, user] of Object.entries(config.users)) {
        if (user.isDev && Number(userId) !== Number(excludeUserId)) {
            await bot.telegram.sendMessage(
                Number(userId),
                message,
                { parse_mode: 'Markdown' }
            ).catch(() => { });
        }
    }
}

module.exports = { notifyDevs };
