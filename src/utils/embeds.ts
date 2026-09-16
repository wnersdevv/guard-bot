import { EmbedBuilder as DjsEmbedBuilder } from "discord.js";
import { BRAND, COLORS } from "@/config/constants";

/**
 * Base builder every WnersGuard embed extends, keeping brand identity
 * (footer, color language) consistent across the whole platform.
 */
class BaseEmbed extends DjsEmbedBuilder {
  constructor() {
    super();
    this.setFooter({ text: BRAND.FOOTER });
    this.setTimestamp();
  }
}

export class SecurityEmbed extends BaseEmbed {
  constructor(title: string, description?: string) {
    super();
    this.setTitle(`🛡️ ${title}`).setColor(COLORS.primary);
    if (description) this.setDescription(description);
  }
}

export class SuccessEmbed extends BaseEmbed {
  constructor(title: string, description?: string) {
    super();
    this.setTitle(`✅ ${title}`).setColor(COLORS.success);
    if (description) this.setDescription(description);
  }
}

export class WarningEmbed extends BaseEmbed {
  constructor(title: string, description?: string) {
    super();
    this.setTitle(`⚠️ ${title}`).setColor(COLORS.warning);
    if (description) this.setDescription(description);
  }
}

export class ErrorEmbed extends BaseEmbed {
  constructor(title: string, description?: string) {
    super();
    this.setTitle(`❌ ${title}`).setColor(COLORS.danger);
    if (description) this.setDescription(description);
  }
}

export class InfoEmbed extends BaseEmbed {
  constructor(title: string, description?: string) {
    super();
    this.setTitle(`ℹ️ ${title}`).setColor(COLORS.info);
    if (description) this.setDescription(description);
  }
}

export class ThreatAlertEmbed extends BaseEmbed {
  constructor(params: {
    eventName: string;
    riskScore: number;
    severity: string;
    action: string;
    executor?: string;
  }) {
    super();
    const color =
      params.severity === "CRITICAL"
        ? COLORS.critical
        : params.severity === "HIGH"
          ? COLORS.danger
          : params.severity === "MEDIUM"
            ? COLORS.warning
            : COLORS.info;

    this.setTitle("🚨 SECURITY ALERT")
      .setColor(color)
      .addFields(
        { name: "Threat", value: params.eventName, inline: false },
        { name: "Risk", value: `${params.riskScore}/100`, inline: true },
        { name: "Severity", value: params.severity, inline: true },
        { name: "Action", value: params.action, inline: true },
        { name: "Executor", value: params.executor ?? "Unknown / Unverified", inline: false },
      );
  }
}
