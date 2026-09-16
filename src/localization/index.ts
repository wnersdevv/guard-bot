import fs from "node:fs";
import path from "node:path";
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/config/constants";

type Namespace = "common" | "security" | "moderation" | "errors" | "settings";
type Dictionary = Record<string, string>;

const cache = new Map<string, Dictionary>();

function loadNamespace(lang: SupportedLanguage, ns: Namespace): Dictionary {
  const cacheKey = `${lang}:${ns}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const filePath = path.join(__dirname, lang, `${ns}.json`);
  const dict: Dictionary = fs.existsSync(filePath)
    ? (JSON.parse(fs.readFileSync(filePath, "utf-8")) as Dictionary)
    : {};
  cache.set(cacheKey, dict);
  return dict;
}

/**
 * Translation lookup. Fallback chain: user language -> guild language -> Turkish.
 * Never hardcode a user-facing string in a command file — always go through t().
 */
export function t(
  key: string,
  opts: { lang?: SupportedLanguage | null; guildLang?: SupportedLanguage | null; ns?: Namespace; vars?: Record<string, string | number> } = {},
): string {
  const ns = opts.ns ?? (key.split(".")[0] as Namespace);
  const candidates: SupportedLanguage[] = [
    opts.lang && SUPPORTED_LANGUAGES.includes(opts.lang) ? opts.lang : null,
    opts.guildLang && SUPPORTED_LANGUAGES.includes(opts.guildLang) ? opts.guildLang : null,
    DEFAULT_LANGUAGE,
  ].filter((l): l is SupportedLanguage => Boolean(l));

  for (const lang of candidates) {
    const dict = loadNamespace(lang, ns);
    const value = dict[key];
    if (value) return interpolate(value, opts.vars);
  }

  return key; // last resort: surface the key so missing translations are visible, not silently blank
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}
