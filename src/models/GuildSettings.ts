import { Schema, model, type InferSchemaType } from "mongoose";
import { DEFAULT_LANGUAGE, DEFAULT_RATE_LIMITS } from "@/config/constants";

const moduleToggle = { type: Boolean, default: true };

const guildSettingsSchema = new Schema(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    language: { type: String, default: DEFAULT_LANGUAGE },
    logChannelId: { type: String, default: null },
    alertChannelId: { type: String, default: null },
    adminRoleId: { type: String, default: null },

    modules: {
      antiNuke: moduleToggle,
      antiRaid: moduleToggle,
      antiSpam: moduleToggle,
      antiWebhook: moduleToggle,
      antiBot: moduleToggle,
      antiMention: moduleToggle,
      roleProtection: moduleToggle,
      channelProtection: moduleToggle,
      serverProtection: moduleToggle,
    },

    thresholds: {
      roleChanges: { count: Number, windowMs: Number },
      channelOperations: { count: Number, windowMs: Number },
      messages: { count: Number, windowMs: Number },
      webhookOperations: { count: Number, windowMs: Number },
    },

    actions: {
      // Per-module configurable response: "log" | "alert" | "protect" | "emergency"
      antiNuke: { type: String, default: "protect" },
      antiRaid: { type: String, default: "protect" },
      antiSpam: { type: String, default: "alert" },
    },

    maintenanceMode: { type: Boolean, default: false },
    emergencyMode: { type: Boolean, default: false },
  },
  { timestamps: true },
);

guildSettingsSchema.path("thresholds").default(DEFAULT_RATE_LIMITS);

export type GuildSettingsDoc = InferSchemaType<typeof guildSettingsSchema>;
export const GuildSettingsModel = model("GuildSettings", guildSettingsSchema);
