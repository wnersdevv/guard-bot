import { createCanvas, type Canvas } from "canvas";
import { BRAND } from "@/config/constants";
import type { ThreatSeverity } from "@/config/constants";

export interface ThreatCardData {
  eventName: string;
  riskScore: number;
  severity: ThreatSeverity;
  status: "BLOCKED" | "ALERTED" | "LOGGED" | "PUNISHED";
}

const SEVERITY_COLOR: Record<ThreatSeverity, string> = {
  LOW: "#3498db",
  MEDIUM: "#FEE75C",
  HIGH: "#ED4245",
  CRITICAL: "#8B0000",
};

/** Renders the per-incident "Threat Card" attached to critical security alerts. */
export function renderThreatCard(data: ThreatCardData): Buffer {
  const width = 700;
  const height = 280;
  const canvas: Canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#141518";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = SEVERITY_COLOR[data.severity];
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, width - 6, height - 6);

  ctx.fillStyle = "#9aa0ac";
  ctx.font = "13px sans-serif";
  ctx.fillText(BRAND.DEVELOPER, 30, 40);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 26px sans-serif";
  ctx.fillText("THREAT DETECTED", 30, 78);

  ctx.font = "bold 20px sans-serif";
  ctx.fillStyle = SEVERITY_COLOR[data.severity];
  ctx.fillText(`Risk: ${data.riskScore}/100`, 30, 130);
  ctx.fillText(`Level: ${data.severity}`, 30, 160);

  ctx.fillStyle = "#ffffff";
  ctx.font = "16px sans-serif";
  ctx.fillText("Event:", 30, 200);
  ctx.font = "bold 16px sans-serif";
  ctx.fillText(data.eventName, 100, 200);

  ctx.font = "16px sans-serif";
  ctx.fillStyle = "#9aa0ac";
  ctx.fillText("Status:", 30, 230);
  ctx.font = "bold 16px sans-serif";
  ctx.fillStyle = data.status === "BLOCKED" || data.status === "PUNISHED" ? "#ED4245" : "#57F287";
  ctx.fillText(data.status, 100, 230);

  return canvas.toBuffer("image/png");
}
