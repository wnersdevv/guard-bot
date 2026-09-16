import mongoose from "mongoose";
import { env } from "@/config/env";
import { databaseLogger } from "@/utils/logger";

let reconnecting = false;

export async function connectDatabase(): Promise<void> {
  mongoose.connection.on("connected", () => databaseLogger.info("MongoDB connected"));
  mongoose.connection.on("disconnected", () => {
    databaseLogger.error("MongoDB disconnected — entering controlled degradation mode");
    scheduleReconnect();
  });
  mongoose.connection.on("error", (err) => databaseLogger.error({ err }, "MongoDB error"));

  await mongoose.connect(env.MONGODB_URI);
}

function scheduleReconnect(): void {
  if (reconnecting) return;
  reconnecting = true;
  setTimeout(() => {
    reconnecting = false;
    mongoose.connect(env.MONGODB_URI).catch((err) => {
      databaseLogger.error({ err }, "MongoDB reconnect attempt failed");
      scheduleReconnect();
    });
  }, 5000);
}

/** Used by critical paths to decide whether to degrade gracefully instead of crashing. */
export function isDatabaseAvailable(): boolean {
  return mongoose.connection.readyState === 1;
}
