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

    captureCalendar(userId, weeks = 0) {
        return new Promise((resolve, reject) => {
            this.queue.push({ userId, weeks, resolve, reject });
            this.processQueue();
        });
    }

    async processQueue() {
        if (this.isProcessing || this.queue.length === 0) return;
        this.isProcessing = true;
        const { userId, weeks, resolve, reject } = this.queue.shift();
        try {
            resolve(await this._doCapture(userId, weeks));
        } catch (err) {
            reject(err);
        } finally {
            this.isProcessing = false;
            if (this.queue.length > 0) this.processQueue();
        }
    }

    async _doCapture(userId, weeks) {
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

            // Navigate Weeks
            if (weeks > 0) {
                console.log(`⏩ [${userId}] Navigating +${weeks} weeks...`);
                for (let i = 0; i < weeks; i++) {
                    const success = await page.evaluate(() => {
                        const buttons = Array.from(document.querySelectorAll('button'));
                        const nextBtn = buttons.find(b =>
                            b.innerText.includes('>') ||
                            (b.getAttribute('aria-label') && b.getAttribute('aria-label').toLowerCase().includes('next')) ||
                            b.querySelector('[data-testid="ArrowForwardIcon"]') ||
                            b.querySelector('svg[class*="ArrowForward"]')
                        );
                        if (nextBtn) {
                            nextBtn.click();
                            return true;
                        }
                        return false;
                    });

                    if (!success) console.warn("Could not navigate next week");
                    await new Promise(r => setTimeout(r, 2000));
                }
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

    async getCalendarText(userId, weeks = 0) {
        await this.init();
        const page = await this.browser.newPage();
        try {
            await page.setViewport({ width: 1920, height: 1080 });
            await this.setupInterception(page);

            const cookies = this.loadCookies(userId);
            if (cookies && cookies.length > 0) await page.setCookie(...cookies);

            await page.goto(CALENDAR_URL, { waitUntil: 'networkidle2', timeout: 30000 });

            // Check login
            if (this.isBaseUrl(page.url())) {
                this.clearCookies(userId);
                await this.login(page, userId);
                await page.goto(CALENDAR_URL, { waitUntil: 'networkidle2', timeout: 30000 });
            }

            // Navigate Weeks
            if (weeks > 0) {
                console.log(`⏩ [${userId}] Navigating +${weeks} weeks...`);
                for (let i = 0; i < weeks; i++) {
                    const success = await page.evaluate(() => {
                        // Try various selectors for "Next" button
                        // 1. Button with ">" text
                        // 2. Button with aria-label containing "next"
                        // 3. SVG icon with "ArrowForward"
                        const buttons = Array.from(document.querySelectorAll('button'));
                        const nextBtn = buttons.find(b =>
                            b.innerText.includes('>') ||
                            (b.getAttribute('aria-label') && b.getAttribute('aria-label').toLowerCase().includes('next')) ||
                            b.querySelector('[data-testid="ArrowForwardIcon"]') ||
                            b.querySelector('svg[class*="ArrowForward"]')
                        );
                        if (nextBtn) {
                            nextBtn.click();
                            return true;
                        }
                        // Fallback: try last button in toolbar?
                        // Assuming toolbar has [Prev] [Today] [Next]
                        // We can't be sure without more info.
                        return false;
                    });

                    if (!success) {
                        return `⚠️ Không tìm thấy nút "Tuần sau". (Web có thể đã đổi)`;
                    }
                    await new Promise(r => setTimeout(r, 2000)); // Wait for AJAX load
                }
            }

            // Extract Text
            // Extract Text Structuredly
            const text = await page.evaluate(() => {
                try {
                    const table = document.querySelector('table');
                    if (!table) return "⚠️ Không tìm thấy bảng lịch học. (Có thể do web thay đổi)";

                    // 1. Get Headers (Dates)
                    const headerRow = table.querySelector('thead tr') || table.querySelector('tr');
                    if (!headerRow) return "⚠️ Bảng lịch trống.";

                    const headers = Array.from(headerRow.querySelectorAll('th, td'))
                        .map(cell => cell.innerText.trim())
                        .filter(text => text.includes('Thứ') || text.includes('Chủ nhật'));

                    // 2. Get Data Rows
                    const rows = Array.from(table.querySelectorAll('tbody tr'));
                    const schedule = [];

                    rows.forEach(row => {
                        const cells = Array.from(row.querySelectorAll('td'));
                        if (cells.length < 2) return;

                        // Identify "Period" (Ca 1, Ca 2...)
                        // Row 1 (Sáng): [Sáng, Ca 1, Mon, Tue...] -> Cells[1] is Period, Cells[2+] are Data
                        // Row 2 (Ca 2): [Ca 2, Mon, Tue...] -> Cells[0] is Period, Cells[1+] are Data

                        let period = '';
                        let dataCells = [];

                        const text0 = cells[0].innerText.trim();
                        // Check if row has rowspan cell "Sáng/Chiều/Tối"
                        if (['Sáng', 'Chiều', 'Tối'].includes(text0)) {
                            period = cells[1] ? cells[1].innerText.trim() : 'Unknown';
                            dataCells = cells.slice(2);
                        } else {
                            period = text0;
                            dataCells = cells.slice(1);
                        }

                        // Map Data to Headers
                        dataCells.forEach((cell, index) => {
                            const content = cell.innerText.trim();
                            if (content && headers[index]) {
                                schedule.push({
                                    day: headers[index],
                                    period: period,
                                    content: content.replace(/\n+/g, ' ; ')
                                });
                            }
                        });
                    });

                    // 3. Format Output
                    let dateInfo = "";
                    const dateInput = document.querySelector('input[type="text"][value*="/"]');
                    if (dateInput) {
                        dateInfo = ` (Tuần: ${dateInput.value})`;
                    } else {
                        // Try finding any date-like text in toolbar
                        const bodyText = document.body.innerText;
                        const dateMatch = bodyText.match(/(\d{2}\/\d{2}\/\d{4})/);
                        if (dateMatch) dateInfo = ` (Tuần: ${dateMatch[1]})`;
                    }

                    if (schedule.length === 0) return `📅 Lịch học${dateInfo}: **TRỐNG** (Không có lịch).`;

                    // Group by Day
                    const grouped = {};
                    schedule.forEach(item => {
                        if (!grouped[item.day]) grouped[item.day] = [];
                        grouped[item.day].push(`+ ${item.period}: ${item.content}`);
                    });

                    // Join
                    const scheduleText = Object.keys(grouped).map(day => {
                        const niceDay = day.replace(/\n/g, ' ');
                        return `📅 **${niceDay}**:\n${grouped[day].join('\n')}`;
                    }).join('\n\n');

                    return `📅 **Lịch học${dateInfo}:**\n\n${scheduleText}`;

                } catch (err) {
                    return `Lỗi parse lịch: ${err.message}`;
                }
            });

            return text;
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
