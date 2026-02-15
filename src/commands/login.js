const { setUser } = require('../utils/config');
const portalScraper = require('../scraper/portal');
const { notifyDevs } = require('../utils/notify');

module.exports = (bot) => {
    bot.command('login', async (ctx) => {
        const args = ctx.message.text.split(' ').slice(1);

        if (args.length < 2) {
            return ctx.reply(
                `🔐 *Đăng ký tài khoản Portal*\n\n` +
                `Cú pháp: /login MSSV mật\\_khẩu\n` +
                `Ví dụ: /login 21520001 password123\n\n` +
                `⚠️ Tin nhắn chứa mật khẩu sẽ tự động bị xóa.`,
                { parse_mode: 'Markdown' }
            );
        }

        const [username, ...passParts] = args;
        const password = passParts.join(' ');

        // Delete message containing credentials immediately
        await ctx.deleteMessage().catch(() => { });

        const statusMsg = await ctx.reply('🔄 Đang kiểm tra tài khoản Portal...');

        try {
            // Save credentials temporarily so scraper can use them
            setUser(ctx.from.id, {
                portalUsername: username,
                portalPassword: password,
            });

            // Try logging in to verify credentials
            const studentName = await portalScraper.verifyLogin(ctx.from.id);

            // Save student name to config
            if (studentName) {
                setUser(ctx.from.id, { displayName: studentName });
            }

            const nameLine = studentName ? `\n🎓 Tên: *${studentName}*` : '';

            await ctx.telegram.editMessageText(
                ctx.chat.id,
                statusMsg.message_id,
                undefined,
                `✅ *Đăng nhập thành công!*\n` +
                `${nameLine}\n` +
                `👤 MSSV: *${username}*\n` +
                `🔒 Mật khẩu: ••••••••\n\n` +
                `Giờ bạn có thể dùng /calendar để chụp lịch học.`,
                { parse_mode: 'Markdown' }
            );

            // Notify devs
            const name = ctx.from.first_name || '';
            await notifyDevs(bot, `🆕 *Đăng nhập mới*\n👤 ${name} (${ctx.from.id})\n🎓 MSSV: ${username}${studentName ? `\n📛 ${studentName}` : ''}`, ctx.from.id);
        } catch (err) {
            // Login failed — clear saved credentials
            setUser(ctx.from.id, {
                portalUsername: null,
                portalPassword: null,
            });

            await ctx.telegram.editMessageText(
                ctx.chat.id,
                statusMsg.message_id,
                undefined,
                `❌ *Đăng nhập thất bại*\n\n` +
                `Lỗi: ${err.message}\n\n` +
                `Vui lòng kiểm tra MSSV/mật khẩu và thử lại:\n` +
                `/login MSSV mật\\_khẩu`,
                { parse_mode: 'Markdown' }
            );
        }
    });
};
