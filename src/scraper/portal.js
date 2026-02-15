const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const COOKIES_PATH = path.join(__dirname, '..', '..', 'data', 'cookies.json');
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

    loadCookies() {
        try {
            if (fs.existsSync(COOKIES_PATH)) {
                return JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf-8'));
            }
        } catch (err) {
            console.warn('⚠️ Could not load cookies:', err.message);
        }
        return null;
    }

    saveCookies(cookies) {
        try {
            const dir = path.dirname(COOKIES_PATH);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
            console.log('💾 Cookies saved');
        } catch (err) {
            console.warn('⚠️ Could not save cookies:', err.message);
        }
    }

    clearCookies() {
        try {
            if (fs.existsSync(COOKIES_PATH)) fs.unlinkSync(COOKIES_PATH);
        } catch (_) { }
    }

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

    /**
     * Check if URL is the base portal page (login page)
     */
    isBaseUrl(url) {
        const u = url.replace(/\/$/, '').toLowerCase();
        return (
            u === PORTAL_URL.toLowerCase() ||
            u.includes('/login') ||
            u.includes('/auth') ||
            u.includes('/signin')
        );
    }

    /**
     * Perform login. Page should already be on the login form.
     */
    async login(page) {
        const username = process.env.PORTAL_USERNAME;
        const password = process.env.PORTAL_PASSWORD;

        if (!username || !password) {
            throw new Error('PORTAL_USERNAME/PORTAL_PASSWORD chưa cấu hình trong .env');
        }

        console.log('🔑 Đang đăng nhập...');

        // Ensure we are on the login page
        if (!this.isBaseUrl(page.url())) {
            await page.goto(PORTAL_URL, { waitUntil: 'networkidle2', timeout: 30000 });
        }

        // Wait for MUI login form
        await page.waitForSelector('input[name="username"]', { timeout: 25000 });
        await new Promise((r) => setTimeout(r, 500));

        // Fill credentials
        const usernameInput = await page.$('input[name="username"]');
        if (!usernameInput) throw new Error('Không tìm thấy ô tài khoản');
        await usernameInput.click({ clickCount: 3 });
        await usernameInput.type(username, { delay: 10 });

        const passwordInput = await page.$('input[name="password"]');
        if (!passwordInput) throw new Error('Không tìm thấy ô mật khẩu');
        await passwordInput.click({ clickCount: 3 });
        await passwordInput.type(password, { delay: 10 });

        // Submit
        const loginBtn = await page.$('button[type="submit"]');
        if (loginBtn) {
            await loginBtn.click();
        } else {
            await passwordInput.press('Enter');
        }

        // Wait for page to change
        await Promise.race([
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => { }),
            new Promise((r) => setTimeout(r, 8000)),
        ]);

        const afterUrl = page.url();
        console.log('📍 After login URL:', afterUrl);

        // If URL changed away from base → login successful
        if (!this.isBaseUrl(afterUrl)) {
            const cookies = await page.cookies();
            this.saveCookies(cookies);
            console.log('✅ Đăng nhập thành công');
            return;
        }

        // Still on base/login URL → login failed
        const errorEl = await page.$('.MuiAlert-root, [class*="error"]');
        if (errorEl) {
            const errorText = await errorEl.evaluate((el) => el.textContent);
            throw new Error(`Đăng nhập thất bại: ${errorText.trim()}`);
        }
        throw new Error('Đăng nhập thất bại: kiểm tra tài khoản/mật khẩu');
    }

    captureCalendar() {
        return new Promise((resolve, reject) => {
            this.queue.push({ resolve, reject });
            this.processQueue();
        });
    }

    async processQueue() {
        if (this.isProcessing || this.queue.length === 0) return;
        this.isProcessing = true;
        const { resolve, reject } = this.queue.shift();
        try {
            resolve(await this._doCapture());
        } catch (err) {
            reject(err);
        } finally {
            this.isProcessing = false;
            if (this.queue.length > 0) this.processQueue();
        }
    }

    async _doCapture() {
        await this.init();
        const page = await this.browser.newPage();

        try {
            await page.setViewport({ width: 1920, height: 1080 });
            await this.setupInterception(page);

            // Load saved cookies
            const cookies = this.loadCookies();
            if (cookies && cookies.length > 0) {
                console.log('🍪 Restoring cookies...');
                await page.setCookie(...cookies);
            }

            // Navigate directly to calendar
            console.log('📍 Navigating to calendar...');
            await page.goto(CALENDAR_URL, { waitUntil: 'networkidle2', timeout: 30000 });
            await new Promise((r) => setTimeout(r, 2000));

            const currentUrl = page.url();
            console.log('📍 Landed on:', currentUrl);

            // If we got redirected to login page → need to login
            if (this.isBaseUrl(currentUrl)) {
                console.log('🔄 Session expired — logging in...');
                this.clearCookies();
                await this.login(page);

                // Now navigate to calendar
                console.log('📍 Navigating to calendar after login...');
                await page.goto(CALENDAR_URL, { waitUntil: 'networkidle2', timeout: 30000 });
            } else {
                console.log('⚡ Cookie valid — on calendar');
            }

            // Wait for SPA calendar to render
            await new Promise((r) => setTimeout(r, 3000));

            const screenshot = await page.screenshot({ type: 'png', fullPage: true });

            // Update cookies
            const newCookies = await page.cookies();
            this.saveCookies(newCookies);

            console.log('📸 Screenshot captured');
            return screenshot;
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
