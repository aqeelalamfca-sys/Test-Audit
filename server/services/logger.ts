type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  [key: string]: unknown;
}

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

const isProduction = process.env.NODE_ENV === "production";
const useJsonLogs = isProduction || process.env.AWS_CLOUDWATCH === "true";
const minLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || (isProduction ? "info" : "debug");
const serviceName = process.env.SERVICE_NAME || "auditwise-api";

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER[minLevel];
}

function formatJson(entry: LogEntry): string {
  return JSON.stringify(entry);
}

function formatHuman(entry: LogEntry): string {
  const time = new Date(entry.timestamp).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  const levelTag = entry.level.toUpperCase().padEnd(5);
  const source = entry.source ? `[${entry.source}]` : `[${entry.service}]`;

  const meta: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(entry)) {
    if (!["timestamp", "level", "message", "service", "source"].includes(k)) {
      meta[k] = v;
    }
  }
  const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";
  return `${time} ${levelTag} ${source} ${entry.message}${metaStr}`;
}

function emit(level: LogLevel, message: string, metadata?: Record<string, unknown>): void {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    service: serviceName,
    ...metadata,
  };

  const output = useJsonLogs ? formatJson(entry) : formatHuman(entry);

  if (level === "error" || level === "fatal") {
    console.error(output);
  } else if (level === "warn") {
    console.warn(output);
  } else {
    console.log(output);
  }
}

export const logger = {
  debug(message: string, metadata?: Record<string, unknown>) {
    emit("debug", message, metadata);
  },
  info(message: string, metadata?: Record<string, unknown>) {
    emit("info", message, metadata);
  },
  warn(message: string, metadata?: Record<string, unknown>) {
    emit("warn", message, metadata);
  },
  error(message: string, metadata?: Record<string, unknown>) {
    emit("error", message, metadata);
  },
  fatal(message: string, metadata?: Record<string, unknown>) {
    emit("fatal", message, metadata);
  },

  child(defaultMeta: Record<string, unknown>) {
    return {
      debug(msg: string, meta?: Record<string, unknown>) {
        emit("debug", msg, { ...defaultMeta, ...meta });
      },
      info(msg: string, meta?: Record<string, unknown>) {
        emit("info", msg, { ...defaultMeta, ...meta });
      },
      warn(msg: string, meta?: Record<string, unknown>) {
        emit("warn", msg, { ...defaultMeta, ...meta });
      },
      error(msg: string, meta?: Record<string, unknown>) {
        emit("error", msg, { ...defaultMeta, ...meta });
      },
      fatal(msg: string, meta?: Record<string, unknown>) {
        emit("fatal", msg, { ...defaultMeta, ...meta });
      },
    };
  },
};
