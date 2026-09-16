import { createCanvas, type Canvas } from "canvas";
import { BRAND } from "@/config/constants";

export interface SecurityReportData {
  threatLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  blocked: number;
  warnings: number;
  raidAttempts: number;
  nukeAttempts: number;
}

const LEVEL_COLOR: Record<SecurityReportData["threatLevel"], string> = {
  LOW: "#57F287",
  MEDIUM: "#FEE75C",
  HIGH: "#ED4245",
  CRITICAL: "#8B0000",
};

/**
 * Renders the "Security Report" card shown via /guvenlik -> İstatistik and
 * periodic digests. Kept deliberately simple (rects + text, no external
 * assets) so it renders identically across environments.
 */
export function renderSecurityReport(data: SecurityReportData): Buffer {
  const width = 900;
  const height = 500;
  const canvas: Canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Background
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#1e1f26");
  bg.addColorStop(1, "#12131a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Header
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 30px sans-serif";
  ctx.fillText(`🛡️ ${BRAND.PRODUCT}`, 40, 60);
  ctx.font = "16px sans-serif";
  ctx.fillStyle = "#9aa0ac";
  ctx.fillText(BRAND.DEVELOPER, 40, 88);

  ctx.font = "bold 22px sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText("SECURITY REPORT", 40, 140);

  // Threat level badge
  ctx.fillStyle = LEVEL_COLOR[data.threatLevel];
  roundRect(ctx, 40, 170, 220, 60, 10);
  ctx.fill();
  ctx.fillStyle = "#0b0b0f";
  ctx.font = "bold 20px sans-serif";
  ctx.fillText(`${data.threatLevel}`, 60, 208);
  ctx.font = "13px sans-serif";
  ctx.fillStyle = "#0b0b0f";
  ctx.fillText("THREAT LEVEL", 60, 178);

  // Stat tiles
  const tiles: Array<[string, number]> = [
    ["Blocked", data.blocked],
    ["Warnings", data.warnings],
    ["Raid Attempts", data.raidAttempts],
    ["Nuke Attempts", data.nukeAttempts],
  ];

  const tileWidth = 190;
  const tileHeight = 130;
  const startX = 40;
  const startY = 260;
  const gap = 20;

  tiles.forEach(([label, value], i) => {
    const x = startX + i * (tileWidth + gap);
    ctx.fillStyle = "#24252e";
    roundRect(ctx, x, startY, tileWidth, tileHeight, 12);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 36px sans-serif";
    ctx.fillText(String(value), x + 20, startY + 60);

    ctx.fillStyle = "#9aa0ac";
    ctx.font = "14px sans-serif";
    ctx.fillText(label, x + 20, startY + 95);
  });

  // Footer
  ctx.fillStyle = "#5a5f6b";
  ctx.font = "12px sans-serif";
  ctx.fillText(BRAND.FOOTER, 40, height - 20);

  return canvas.toBuffer("image/png");
}

function roundRect(ctx: ReturnType<Canvas["getContext"]>, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
