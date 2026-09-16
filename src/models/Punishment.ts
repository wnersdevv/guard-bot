import { Schema, model, type InferSchemaType } from "mongoose";

const punishmentSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    type: { type: String, enum: ["WARN", "MUTE", "KICK", "BAN"], required: true },
    targetId: { type: String, required: true, index: true },
    moderatorId: { type: String, required: true },
    reason: { type: String, default: "Sebep belirtilmedi" },
    durationMs: { type: Number, default: null },
  },
  { timestamps: true },
);

export type PunishmentDoc = InferSchemaType<typeof punishmentSchema>;
export const PunishmentModel = model("Punishment", punishmentSchema);
