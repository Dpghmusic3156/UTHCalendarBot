const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { getPortalCredentials, getUserCookiePath } = require('../utils/config');

const PORTAL_URL = 'https://portal.ut.edu.vn';
const CALENDAR_URL = 'https://portal.ut.edu.vn/calendar';

const BLOCKED_DOMAINS = [
    'googletagmanager.com',
    'google-analytics.com',
    'facebook.net',
    'facebook.com',
    'doubleclick.net',
];

class PortalScraper {
    constructor() {
        this.browser = null;
        this.isProcessing = false;
        this.queue = [];
    }

    async init() {
        if (this.browser) {
            if (!this.browser.connected) {
                console.log('🔄 Browser disconnected, re-launching...');
                this.browser = null;
            } else {
                return;
            }
        }

        this.browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-extensions',
                '--disable-background-networking',
                '--disable-default-apps',
                '--disable-translate',
                '--no-first-run',
                '--disable-infobars',
            ],
        });

        console.log('🌐 Browser launched');
    }

    // --- Per-user cookie management ---

    loadCookies(userId) {
        try {
            const cookiePath = getUserCookiePath(userId);
            if (fs.existsSync(cookiePath)) {
                return JSON.parse(fs.readFileSync(cookiePath, 'utf-8'));
            }
        } catch (err) {
            console.warn(`⚠️ Could not load cookies for ${userId}:`, err.message);
        }
        return null;
    }

    saveCookies(userId, cookies) {
        try {
            const cookiePath = getUserCookiePath(userId);
            const dir = path.dirname(cookiePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(cookiePath, JSON.stringify(cookies, null, 2));
        } catch (err) {
            console.warn(`⚠️ Could not save cookies for ${userId}:`, err.message);
        }
    }

    clearCookies(userId) {
        try {
            const cookiePath = getUserCookiePath(userId);
            if (fs.existsSync(cookiePath)) fs.unlinkSync(cookiePath);
        } catch (_) { }
    }

    // --- Page helpers ---

    async setupInterception(page) {
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const url = req.url();
            const type = req.resourceType();
            if (BLOCKED_DOMAINS.some((d) => url.includes(d))) return req.abort();
            if (['media', 'websocket'].includes(type)) return req.abort();
            req.continue();
        });
    }

    isBaseUrl(url) {
        const u = url.replace(/\/$/, '').toLowerCase();
        return (
            u === PORTAL_URL.toLowerCase() ||
            u.includes('/login') ||
            u.includes('/auth') ||
            u.includes('/signin')
        );
    }

    // --- Login with per-user credentials ---

    async login(page, userId) {
        const creds = getPortalCredentials(userId);
        if (!creds) {
            throw new Error('Bạn chưa đăng nhập tài khoản portal.\nDùng /login <MSSV> <mật_khẩu> để đăng nhập.');
        }

        console.log(`🔑 [${userId}] Đang đăng nhập...`);

        if (!this.isBaseUrl(page.url())) {
            await page.goto(PORTAL_URL, { waitUntil: 'networkidle2', timeout: 30000 });
        }

        await page.waitForSelector('input[name="username"]', { timeout: 25000 });
        await new Promise((r) => setTimeout(r, 500));

        const usernameInput = await page.$('input[name="username"]');
        if (!usernameInput) throw new Error('Không tìm thấy ô tài khoản');
        await usernameInput.click({ clickCount: 3 });
        await usernameInput.type(creds.username, { delay: 10 });

        const passwordInput = await page.$('input[name="password"]');
        if (!passwordInput) throw new Error('Không tìm thấy ô mật khẩu');
        await passwordInput.click({ clickCount: 3 });
        await passwordInput.type(creds.password, { delay: 10 });

        const loginBtn = await page.$('button[type="submit"]');
        if (loginBtn) {
            await loginBtn.click();
        } else {
            await passwordInput.press('Enter');
        }

        await Promise.race([
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => { }),
            new Promise((r) => setTimeout(r, 8000)),
        ]);

        const afterUrl = page.url();
        console.log(`📍 [${userId}] After login URL:`, afterUrl);

        if (!this.isBaseUrl(afterUrl)) {
            const cookies = await page.cookies();
            this.saveCookies(userId, cookies);
            console.log(`✅ [${userId}] Đăng nhập thành công`);
            return;
        }

        const errorEl = await page.$('.MuiAlert-root, [class*="error"]');
        if (errorEl) {
            const errorText = await errorEl.evaluate((el) => el.textContent);
            throw new Error(`Đăng nhập thất bại: ${errorText.trim()}`);
        }
        throw new Error('Đăng nhập thất bại: kiểm tra tài khoản/mật khẩu');
    }

    // --- Queue system ---

    captureCalendar(userId) {
        return new Promise((resolve, reject) => {
            this.queue.push({ userId, resolve, reject });
            this.processQueue();
        });
    }

    async processQueue() {
        if (this.isProcessing || this.queue.length === 0) return;
        this.isProcessing = true;
        const { userId, resolve, reject } = this.queue.shift();
        try {
            resolve(await this._doCapture(userId));
        } catch (err) {
            reject(err);
        } finally {
            this.isProcessing = false;
            if (this.queue.length > 0) this.processQueue();
        }
    }

    async _doCapture(userId) {
        await this.init();
        const page = await this.browser.newPage();

        try {
            await page.setViewport({ width: 1920, height: 1080 });
            await this.setupInterception(page);

            // Load user's cookies
            const cookies = this.loadCookies(userId);
            if (cookies && cookies.length > 0) {
                await page.setCookie(...cookies);
            }

            // Navigate to calendar
            console.log(`📍 [${userId}] Navigating to calendar...`);
            await page.goto(CALENDAR_URL, { waitUntil: 'networkidle2', timeout: 30000 });
            await new Promise((r) => setTimeout(r, 2000));

            const currentUrl = page.url();
            console.log(`📍 [${userId}] Landed on:`, currentUrl);

            if (this.isBaseUrl(currentUrl)) {
                console.log(`🔄 [${userId}] Session expired — logging in...`);
                this.clearCookies(userId);
                await this.login(page, userId);

                await page.goto(CALENDAR_URL, { waitUntil: 'networkidle2', timeout: 30000 });
            } else {
                console.log(`⚡ [${userId}] Cookie valid`);
            }

            await new Promise((r) => setTimeout(r, 3000));

            // Try to screenshot just the calendar table element
            let screenshot;
            const calendarEl = await page.$('.MuiPaper-root, .MuiTableContainer-root, [class*="calendar"], table').catch(() => null);
            if (calendarEl) {
                // Add small padding by getting bounding box and clipping
                const box = await calendarEl.boundingBox();
                if (box) {
                    const pad = 16;
                    screenshot = await page.screenshot({
                        type: 'png',
                        clip: {
                            x: Math.max(0, box.x - pad),
                            y: Math.max(0, box.y - pad),
                            width: box.width + pad * 2,
                            height: box.height + pad * 2,
                        },
                    });
                } else {
                    screenshot = await page.screenshot({ type: 'png', fullPage: true });
                }
            } else {
                screenshot = await page.screenshot({ type: 'png', fullPage: true });
            }

            // Update cookies
            const newCookies = await page.cookies();
            this.saveCookies(userId, newCookies);

            console.log(`📸 [${userId}] Screenshot captured`);
            return screenshot;
        } finally {
            await page.close();
        }
    }

    // --- Refresh session for cron ---

    async refreshSession(userId) {
        await this.init();
        const page = await this.browser.newPage();

        try {
            await page.setViewport({ width: 1920, height: 1080 });
            await this.setupInterception(page);

            this.clearCookies(userId);
            await page.goto(PORTAL_URL, { waitUntil: 'networkidle2', timeout: 30000 });
            await this.login(page, userId);

            console.log(`🔄 [${userId}] Session refreshed`);
        } finally {
            await page.close();
        }
    }

    /**
     * Verify login credentials by actually logging in.
     * Returns student name on success, throws on failure.
     */
    async verifyLogin(userId) {
        await this.init();
        const page = await this.browser.newPage();

        try {
            await page.setViewport({ width: 1920, height: 1080 });
            await this.setupInterception(page);

            this.clearCookies(userId);
            await page.goto(PORTAL_URL, { waitUntil: 'networkidle2', timeout: 30000 });
            await this.login(page, userId);

            // Try to extract student name from dashboard
            let studentName = null;
            try {
                await new Promise((r) => setTimeout(r, 2000));
                // Look for common name elements in SPA dashboards
                studentName = await page.evaluate(() => {
                    // Try multiple selectors that might contain the student name
                    const selectors = [
                        '.MuiTypography-root', '.user-name', '.student-name',
                        '[class*="name"]', '[class*="user"]', '.MuiAvatar-root',
                        'header .MuiTypography-root', 'nav .MuiTypography-root',
                    ];
                    for (const sel of selectors) {
                        const els = document.querySelectorAll(sel);
                        for (const el of els) {
                            const text = el.textContent.trim();
                            // Name should be 2+ words, not too long, no numbers-only
                            if (text && text.length > 3 && text.length < 50 && /[a-zA-ZÀ-ỹ]/.test(text)) {
                                return text;
                            }
                        }
                    }
                    return null;
                });
            } catch (_) { }

            console.log(`✅ [${userId}] Credentials verified, name: ${studentName || 'unknown'}`);

            // Save cookies after successful login
            const cookies = await page.cookies();
            this.saveCookies(userId, cookies);
            console.log(`💾 [${userId}] Cookies saved (${cookies.length} cookies)`);

            return studentName;
        } finally {
            await page.close();
        }
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            console.log('🌐 Browser closed');
        }
    }
}

module.exports = new PortalScraper();
