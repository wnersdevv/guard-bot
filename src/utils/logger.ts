import pino from "pino";
import { env } from "@/config/env";

export const logger = pino({
  level: env.LOG_LEVEL,
  transport:
    env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } }
      : undefined,
  redact: {
    paths: ["token", "*.token", "DISCORD_TOKEN", "*.password", "*.secret"],
    censor: "[REDACTED]",
  },
});

export const securityLogger = logger.child({ scope: "SECURITY" });
export const databaseLogger = logger.child({ scope: "DATABASE" });
export const discordLogger = logger.child({ scope: "DISCORD" });
