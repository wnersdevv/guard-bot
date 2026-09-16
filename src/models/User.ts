import { Schema, model, type InferSchemaType } from "mongoose";

const userSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    language: { type: String, default: null },
    riskScore: { type: Number, default: 0 },
    flags: { type: [String], default: [] },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof userSchema>;
export const UserModel = model("User", userSchema);
