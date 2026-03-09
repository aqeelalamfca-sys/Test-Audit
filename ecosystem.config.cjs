module.exports = {
  apps: [{
    name: 'auditwise',
    script: 'dist/index.cjs',
    cwd: '/opt/auditwise',
    node_args: '--max-old-space-size=2560',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '3G',
    error_file: '/opt/auditwise/logs/pm2-error.log',
    out_file: '/opt/auditwise/logs/pm2-out.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    restart_delay: 5000,
    max_restarts: 10,
    min_uptime: '10s',
    kill_timeout: 10000
  }]
};
