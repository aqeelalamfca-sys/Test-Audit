module.exports = {
  apps: [{
    name: "auditwise",
    script: "dist/index.cjs",
    node_args: "--max-old-space-size=2560",
    instances: 1,
    exec_mode: "fork",
    env: {
      NODE_ENV: "production",
      PORT: 5000,
    },
    max_memory_restart: "3G",
    kill_timeout: 15000,
    wait_ready: true,
    listen_timeout: 120000,
    log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    error_file: "/var/log/auditwise/error.log",
    out_file: "/var/log/auditwise/out.log",
    merge_logs: true,
    max_restarts: 10,
    restart_delay: 5000,
    autorestart: true,
  }],
};
