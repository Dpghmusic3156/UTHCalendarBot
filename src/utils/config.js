const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', '..', 'data', 'config.json');

function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
        }
    } catch (_) { }
    return { users: {} };
}

function saveConfig(config) {
    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function getUser(userId) {
    const config = loadConfig();
    if (!config.users) config.users = {};
    return config.users[String(userId)] || {};
}

function setUser(userId, data) {
    const config = loadConfig();
    if (!config.users) config.users = {};
    const key = String(userId);
    config.users[key] = { ...(config.users[key] || {}), ...data };
    saveConfig(config);
}

const DEFAULT_CRON_HOUR = 4; // 4:00 AM UTC+7

/**
 * Get all users with portal credentials for auto-login.
 * Default cronHour = 4 unless explicitly changed by dev.
 */
function getSubscribedUsers() {
    const config = loadConfig();
    if (!config.users) return [];
    return Object.entries(config.users)
        .filter(([_, u]) => u.portalUsername)
        .map(([id, u]) => ({
            chatId: Number(id),
            cronHour: u.cronHour !== undefined && u.cronHour !== null ? u.cronHour : DEFAULT_CRON_HOUR,
            portalUsername: u.portalUsername,
            portalPassword: u.portalPassword,
        }));
}

/**
 * Get user's portal credentials
 */
function getPortalCredentials(userId) {
    const user = getUser(userId);
    if (user.portalUsername && user.portalPassword) {
        return { username: user.portalUsername, password: user.portalPassword };
    }
    return null;
}

/**
 * Get user's cookie file path
 */
function getUserCookiePath(userId) {
    return path.join(__dirname, '..', '..', 'data', 'cookies', `${userId}.json`);
}

module.exports = {
    loadConfig, saveConfig, getUser, setUser,
    getSubscribedUsers, getPortalCredentials, getUserCookiePath,
    CONFIG_PATH, DEFAULT_CRON_HOUR,
};
