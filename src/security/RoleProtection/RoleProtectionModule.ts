import { AuditLogEvent, type Role } from "discord.js";
import { ThreatEngine } from "@/engines/ThreatEngine";
import { ResponseEngine } from "@/engines/ResponseEngine";
import { AuditEngine } from "@/engines/AuditEngine";
import { WhitelistService } from "@/services/WhitelistService";
import { isModuleEnabled } from "@/middleware/moduleGuard";

const WATCHED_PERMISSIONS = [
  "Administrator",
  "ManageGuild",
  "ManageRoles",
  "ManageChannels",
  "ManageWebhooks",
  "BanMembers",
  "KickMembers",
] as const;

/**
 * Role Protection: watches permission changes on existing roles (not
 * creation/deletion — that's Anti-Nuke's job) so a role that quietly gains
 * Administrator after the fact doesn't slip past detection.
 */
export class RoleProtectionModule {
  static async onRoleUpdate(oldRole: Role, newRole: Role): Promise<void> {
    if (!(await isModuleEnabled(newRole.guild.id, "roleProtection"))) return;
    const gained = WATCHED_PERMISSIONS.filter(
      (perm) => !oldRole.permissions.has(perm) && newRole.permissions.has(perm),
    );
    if (gained.length === 0) return;

    const executorId = await AuditEngine.findExecutor(newRole.guild, AuditLogEvent.RoleUpdate, newRole.id);
    if (executorId && (await this.isExecutorSafe(newRole, executorId))) return;

    const { score, severity, reasons } = ThreatEngine.score([
      { reason: `Role "${newRole.name}" gained: ${gained.join(", ")}`, weight: 30 + gained.length * 15 },
    ]);

    await ResponseEngine.handle(newRole.guild, severity, {
      guildId: newRole.guild.id,
      type: "roleProtection.permissionEscalation",
      executorId,
      targetId: newRole.id,
      riskScore: score,
      severity,
      action: "LOGGED",
      metadata: { reasons, gained, roleName: newRole.name },
    });
  }

  private static async isExecutorSafe(role: Role, executorId: string): Promise<boolean> {
    if (executorId === role.guild.ownerId) return true;
    const member = await role.guild.members.fetch(executorId).catch(() => null);
    const roleIds = member ? [...member.roles.cache.keys()] : [];
    return WhitelistService.isWhitelisted({ guildId: role.guild.id, userId: executorId, roleIds });
  }
}
