module.exports = {
  apps: [
    {
      name: "data-agent",
      script: "scripts/data-agent.js",
      cron_restart: "0 6 * * *", // Run daily at 6am UTC
      watch: false,
      autorestart: false, // Do not restart after normal exit
      env: {
        NODE_ENV: "production",
        DATA_MODE: "daily",
      },
    },
  ],
};

