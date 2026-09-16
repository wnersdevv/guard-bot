import { Schema, model, type InferSchemaType } from "mongoose";

const securityEventSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    type: { type: String, required: true, index: true },
    executorId: { type: String, default: null, index: true },
    targetId: { type: String, default: null },
    riskScore: { type: Number, required: true },
    severity: { type: String, enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"], required: true },
    action: { type: String, enum: ["LOGGED", "ALERTED", "BLOCKED", "PUNISHED"], required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

securityEventSchema.index({ guildId: 1, createdAt: -1 });
securityEventSchema.index({ guildId: 1, executorId: 1, createdAt: -1 });
securityEventSchema.index({ guildId: 1, type: 1, createdAt: -1 });

export type SecurityEventDoc = InferSchemaType<typeof securityEventSchema>;
export const SecurityEventModel = model("SecurityEvent", securityEventSchema);
