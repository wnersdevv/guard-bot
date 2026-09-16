import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { connectDatabase, isDatabaseAvailable } from "@/database/connection";
import { GuildSettingsModel } from "@/models/GuildSettings";

/**
 * Integration test against a real MongoDB — everything else in this suite
 * that touches models (e.g. via services) never actually connects, because
 * isDatabaseAvailable() is false without one. Run this against a real
 * Mongo (see docker-compose.yml):
 *
 *   docker compose up -d mongo
 *   MONGODB_URI=mongodb://localhost:27017/wnersguard-test RUN_MONGO_INTEGRATION=1 npm test
 *
 * Gated on RUN_MONGO_INTEGRATION rather than just MONGODB_URI, because
 * ayarlar.test.json always sets a (non-connectable) dummy MONGODB_URI so
 * other tests can import env.ts without crashing — that dummy value alone
 * must never be mistaken for "a real Mongo is available."
 */
const shouldRun = process.env.RUN_MONGO_INTEGRATION === "1";

describe.skipIf(!shouldRun)("MongoDB integration (live MongoDB required)", () => {
  const guildId = `test-guild-${Date.now()}`;

  beforeAll(async () => {
    await connectDatabase();
  });

  afterAll(async () => {
    await GuildSettingsModel.deleteOne({ guildId });
    await mongoose.disconnect();
  });

  it("reports the database as available once connected", () => {
    expect(isDatabaseAvailable()).toBe(true);
  });

  it("upserts and reads back a GuildSettings document", async () => {
    await GuildSettingsModel.findOneAndUpdate(
      { guildId },
      { $set: { language: "en" } },
      { upsert: true, setDefaultsOnInsert: true },
    );

    const doc = await GuildSettingsModel.findOne({ guildId }).lean();
    expect(doc?.language).toBe("en");
    expect(doc?.modules?.antiNuke).toBe(true); // schema default applied
  });
});
