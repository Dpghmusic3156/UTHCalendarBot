module.exports = {
    apps: [
        {
            name: 'portal-uth-bot',
            script: 'src/bot.js',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '512M',
            restart_delay: 5000,
            max_restarts: 50,
            env: {
                NODE_ENV: 'production',
            },
        },
    ],
};
