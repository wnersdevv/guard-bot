import { WhitelistModel, type WhitelistDoc } from "@/models/Whitelist";
import { isDatabaseAvailable } from "@/database/connection";

export type WhitelistCheckInput = {
  guildId: string;
  userId: string;
  roleIds: string[];
};

/**
 * Whitelist checks are consulted before any automated response fires.
 * If the database is unavailable, this fails CLOSED for whitelist purposes
 * (i.e. does not silently grant bypass) — critical actions should already
 * be gated by their own DB-availability checks upstream.
 */
export class WhitelistService {
  static async isWhitelisted(input: WhitelistCheckInput): Promise<boolean> {
    if (!isDatabaseAvailable()) return false;

    const entries: WhitelistDoc[] = await WhitelistModel.find({
      guildId: input.guildId,
      $or: [
        { type: "USER", targetId: input.userId },
        { type: "ROLE", targetId: { $in: input.roleIds } },
      ],
    }).lean();

    return entries.length > 0;
  }

  static async isBotWhitelisted(guildId: string, botId: string): Promise<boolean> {
    if (!isDatabaseAvailable()) return false;
    const entry = await WhitelistModel.findOne({ guildId, type: "BOT", targetId: botId }).lean();
    return Boolean(entry);
  }
}
