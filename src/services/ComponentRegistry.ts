import fs from "node:fs";
import path from "node:path";
import type { ButtonInteraction, StringSelectMenuInteraction, ModalSubmitInteraction } from "discord.js";
import { discordLogger } from "@/utils/logger";

export interface ButtonHandler {
  /** Exact customId (e.g. "guvenlik:koruma") or, for dynamic ids, a prefix (e.g. "tehdit:detay") + isPrefix: true. */
  customId: string;
  isPrefix?: boolean;
  execute: (interaction: ButtonInteraction) => Promise<void>;
}

export interface SelectMenuHandler {
  customId: string;
  isPrefix?: boolean;
  execute: (interaction: StringSelectMenuInteraction) => Promise<void>;
}

export interface ModalHandler {
  customId: string;
  isPrefix?: boolean;
  execute: (interaction: ModalSubmitInteraction) => Promise<void>;
}

type AnyHandler = ButtonHandler | SelectMenuHandler | ModalHandler;

function loadHandlers<T extends AnyHandler>(dir: string): T[] {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".ts") || f.endsWith(".js"));
  const handlers: T[] = [];
  for (const file of files) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(path.join(dir, file)) as T;
    if (!mod.customId || !mod.execute) {
      discordLogger.warn({ file }, "Skipped invalid component handler (missing customId/execute)");
      continue;
    }
    handlers.push(mod);
    discordLogger.info({ customId: mod.customId, isPrefix: Boolean(mod.isPrefix) }, "Component handler loaded");
  }
  return handlers;
}

/** Finds the handler for a given customId: exact match wins, then longest matching prefix. */
export function resolveHandler<T extends AnyHandler>(handlers: T[], customId: string): T | undefined {
  const exact = handlers.find((h) => !h.isPrefix && h.customId === customId);
  if (exact) return exact;

  const prefixMatches = handlers
    .filter((h) => h.isPrefix && customId.startsWith(`${h.customId}:`))
    .sort((a, b) => b.customId.length - a.customId.length);

  return prefixMatches[0];
}

export function loadButtonHandlers(dir: string): ButtonHandler[] {
  return loadHandlers<ButtonHandler>(dir);
}

export function loadSelectMenuHandlers(dir: string): SelectMenuHandler[] {
  return loadHandlers<SelectMenuHandler>(dir);
}

export function loadModalHandlers(dir: string): ModalHandler[] {
  return loadHandlers<ModalHandler>(dir);
}
