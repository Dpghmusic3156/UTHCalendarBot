const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const portalScraper = require('../scraper/portal');
const { setUser, getUser } = require('../utils/config');

const ZALO_API_URL = 'https://bot-api.zaloplatforms.com/bot';
const POLLING_INTERVAL = 2000; // 2s

let token = null;
const processedIds = new Set();
const MAX_HISTORY = 1000;
let isPolling = false;

// State Machine for Login
const userStates = {}; // senderId -> { step: 'LOGIN_USER'|'LOGIN_PASS', data: {} }

function init(botToken) {
    if (!botToken) {
        console.error('❌ ZALO_BOT_TOKEN is missing. Zalo bot will not start.');
        return;
    }
    token = botToken;
    isPolling = true;
    console.log('🚀 Starting Zalo bot polling...');
    poll();
}

async function poll() {
    if (!isPolling) return;

    try {
        const url = `${ZALO_API_URL}${token}/getUpdates`;
        const body = { timeout: 10000 };

        const res = await axios.post(url, body, { timeout: 20000 });

        // console.log('📥 [Zalo] Raw Response:', JSON.stringify(res.data)); // Reduced noise

        const rawData = res.data.data || res.data.result;
        const updates = Array.isArray(rawData) ? rawData : (rawData ? [rawData] : []);

        if (updates.length > 0) {
            console.log(`📥 [Zalo] Updates: ${updates.length}`);
            for (const update of updates) {
                await processUpdate(update);
            }
        }
    } catch (err) {
        if (err.code === 'ECONNABORTED') {
            // Timeout normal
        } else {
            console.error('❌ Zalo polling error:', err.message);
        }
    } finally {
        setTimeout(poll, POLLING_INTERVAL);
    }
}

async function processUpdate(update) {
    try {
        const msg = update.message || update;
        const msgId = msg.message_id || msg.msg_id;
        const senderId = msg.sender ? msg.sender.id : (msg.from ? msg.from.id : null);
        const text = msg.text || (msg.content ? msg.content.text : '');

        if (!msgId || !senderId || !text) return;

        console.log(`DEBUG_RAW_TEXT: ${text}`);

        if (processedIds.has(msgId)) return;
        processedIds.add(msgId);

        if (processedIds.size > MAX_HISTORY) {
            const first = processedIds.values().next().value;
            processedIds.delete(first);
        }

        console.log(`📨 [Zalo] from ${senderId}: ${text}`);

        // --- State Machine Handling ---
        if (userStates[senderId]) {
            await handleStateInput(senderId, text);
            return;
        }

        if (!text.startsWith('/')) return;

        const args = text.trim().split(/\s+/);
        const command = args[0].toLowerCase();

        console.log(`🔍 [Zalo] Parsed command: '${command}', args: ${args.length}`);

        try {
            if (command === '/start') {
                await sendMessage(senderId, `👋 Chào bạn! Mình là Bot Portal UTH.\n\nHãy dùng /login để bắt đầu nhé!\n(Bot sẽ hỏi MSSV và Mật khẩu từng bước)`);
            }
            else if (command === '/login') {
                userStates[senderId] = { step: 'LOGIN_USER', data: {} };
                await sendMessage(senderId, '👉 Vui lòng nhập **MSSV**:');
            }
            else if (command === '/calendar') {
                const offsetParam = args[1] ? args[1].replace('+', '') : '0';
                const offset = parseInt(offsetParam);
                await handleCalendar(senderId, isNaN(offset) ? 0 : offset);
            }
            else if (command === '/help') {
                if (args.length > 1) {
                    await sendMessage(senderId, `✅ Test Tham Số: ${args.slice(1).join(' ')}`);
                } else {
                    await sendMessage(senderId,
                        `📖 *Lệnh Zalo Bot:*\n\n` +
                        `🔐 /login — Đăng nhập hệ thống\n` +
                        `📅 /calendar — Xem lịch tuần hiện tại\n` +
                        `📅 /calendar +1 — Xem lịch tuần sau\n` +
                        `📅 /calendar +2 — Xem lịch 2 tuần nữa\n` +
                        `❓ /help — Hướng dẫn sử dụng`
                    );
                }
            }
            else {
                console.log(`⚠️ [Zalo] Unknown command: '${command}'`);
                await sendMessage(senderId, `⚠️ Lệnh không hợp lệ: ${command}`);
            }
        } catch (innerErr) {
            console.error(`❌ [Zalo] Command execution failed:`, innerErr);
            await sendMessage(senderId, `❌ Lỗi khi xử lý lệnh: ${innerErr.message}`);
        }
    } catch (err) {
        console.error('🔥 [CRITICAL] processUpdate crashed:', err);
    }
}

async function handleStateInput(senderId, text) {
    const state = userStates[senderId];

    if (state.step === 'LOGIN_USER') {
        const username = text.trim();
        // Validate MSSV (Number only)
        if (!/^\d+$/.test(username)) {
            await sendMessage(senderId, '⚠️ MSSV không hợp lệ. Vui lòng chỉ nhập số (VD: 052206008888)\n👉 Nhập lại MSSV:');
            return;
        }

        state.data.username = username;
        state.step = 'LOGIN_PASS';
        await sendMessage(senderId, '👉 Vui lòng nhập **Mật khẩu**:');
    }
    else if (state.step === 'LOGIN_PASS') {
        state.data.password = text.trim();
        delete userStates[senderId];
        await processLogin(senderId, state.data.username, state.data.password);
    }
}

async function processLogin(senderId, username, password) {
    await sendMessage(senderId, '🔄 Đang kiểm tra đăng nhập...');
    console.log(`🔐 [Zalo] Verifying credentials for ${username}...`);

    setUser(senderId, {
        portalUsername: username,
        portalPassword: password
    });

    try {
        const studentName = await portalScraper.verifyLogin(senderId);
        console.log(`✅ [Zalo] Login verified: ${studentName}`);

        if (studentName) {
            setUser(senderId, { displayName: studentName });
        }

        await sendMessage(senderId,
            `✅ Đăng nhập thành công!\n` +
            `🎓 SV: ${studentName || username}\n` +
            `Gõ /calendar để xem lịch.`
        );
    } catch (err) {
        console.error(`❌ [Zalo] Login failed:`, err.message);
        await sendMessage(senderId, `❌ Đăng nhập thất bại: ${err.message}`);
    }
}

async function handleCalendar(senderId, weekOffset = 0) {
    const user = getUser(senderId);
    if (!user.portalUsername) {
        return sendMessage(senderId, '⚠️ Bạn chưa đăng nhập. Dùng /login nhé.');
    }

    const msg = weekOffset === 0
        ? '⏳ Đang tải lịch học (Tuần này)...'
        : `⏳ Đang tải lịch học (+${weekOffset} tuần)...`;

    await sendMessage(senderId, msg);

    try {
        // 1. Try to Capture & Send Photo (via Proxy)
        try {
            const screenshotBuffer = await portalScraper.captureCalendar(senderId, weekOffset);
            if (screenshotBuffer) {
                const photoUrl = await uploadToTmpfiles(screenshotBuffer);
                if (photoUrl) {
                    const caption = weekOffset === 0
                        ? '📅 Lịch học: Tuần hiện tại'
                        : `📅 Lịch học: Tuần +${weekOffset}`;
                    await sendPhoto(senderId, photoUrl, caption);
                    // Stop here if photo sent successfully
                    return;
                } else {
                    throw new Error("Upload failed");
                }
            }
        } catch (photoErr) {
            console.error(`⚠️ [Zalo] Photo send failed, falling back to text:`, photoErr.message);
            await sendMessage(senderId, `⚠️ Không gửi được ảnh (${photoErr.message}). Đang lấy Text...`);
        }

        // 2. Fallback to Text if photo failed
        const textCal = await portalScraper.getCalendarText(senderId, weekOffset);

        // Format text
        const cleanText = textCal
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .join('\n')
            .substring(0, 1900); // Zalo limit

        await sendMessage(senderId, `� **Chi tiết:**\n\n${cleanText}`);

    } catch (err) {
        console.error(`❌ [Zalo] Calendar error:`, err);
        await sendMessage(senderId, `❌ Lỗi lấy lịch: ${err.message}`);
    }
}

const { Readable } = require('stream');

async function uploadToTmpfiles(buffer) {
    const tempPath = path.join(__dirname, `temp_cal_${Date.now()}.png`);
    try {
        fs.writeFileSync(tempPath, buffer);
        console.log(`📂 [Upload] Temp file created: ${tempPath}`);

        const form = new FormData();
        form.append('file', fs.createReadStream(tempPath));

        const res = await axios.post('https://tmpfiles.org/api/v1/upload', form, {
            headers: form.getHeaders(),
            timeout: 60000,
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });

        if (res.data && res.data.status === 'success') {
            const rawUrl = res.data.data.url;
            return rawUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
        }
        return null;
    } catch (err) {
        console.error('❌ [Upload] Failed:', err.message);
        return null;
    } finally {
        if (fs.existsSync(tempPath)) {
            try { fs.unlinkSync(tempPath); } catch (_) { }
        }
    }
}

async function sendPhoto(chatId, photoUrl, caption) {
    const url = `${ZALO_API_URL}${token}/sendPhoto`;
    const body = {
        chat_id: chatId,
        photo: photoUrl,
        caption: caption
    };

    console.log(`📤 [Zalo] Sending Photo: ${photoUrl}`);
    const res = await axios.post(url, body, {
        headers: { 'Content-Type': 'application/json' }
    });

    if (res.data.error_code !== 0) {
        throw new Error(`Zalo Error ${res.data.error_code}: ${res.data.error_message}`);
    }
    console.log(`✅ [Zalo] Photo sent success`);
}

async function sendMessage(chatId, text) {
    try {
        const url = `${ZALO_API_URL}${token}/sendMessage`;
        console.log(`📤 [Zalo] Sending to ${chatId}: ${text}`);
        const res = await axios.post(url, {
            chat_id: chatId,
            text: text
        });
        console.log(`✅ [Zalo] Sent success: ${JSON.stringify(res.data)}`);
    } catch (err) {
        console.error(`❌ [Zalo] Send failed: ${err.message}`);
        if (err.response) {
            console.error(`   Data: ${JSON.stringify(err.response.data)}`);
        }
    }
}

// sendPhoto is removed/unused for now

module.exports = { init };
