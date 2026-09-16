import { Schema, model, type InferSchemaType } from "mongoose";

const backupSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    createdBy: { type: String, required: true },
    data: {
      categories: { type: Schema.Types.Mixed, default: [] },
      channels: { type: Schema.Types.Mixed, default: [] },
      roles: { type: Schema.Types.Mixed, default: [] },
      settings: { type: Schema.Types.Mixed, default: {} },
    },
  },
  { timestamps: true },
);

export type BackupDoc = InferSchemaType<typeof backupSchema>;
export const BackupModel = model("Backup", backupSchema);
