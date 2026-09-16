import { Schema, model, type InferSchemaType } from "mongoose";

const whitelistSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    type: { type: String, enum: ["USER", "ROLE", "BOT", "CHANNEL"], required: true },
    targetId: { type: String, required: true },
    addedBy: { type: String, required: true },
    reason: { type: String, default: null },
  },
  { timestamps: true },
);

whitelistSchema.index({ guildId: 1, type: 1, targetId: 1 }, { unique: true });

export type WhitelistDoc = InferSchemaType<typeof whitelistSchema>;
export const WhitelistModel = model("Whitelist", whitelistSchema);
