# Changelog

Build history for WnersGuard, phase by phase. The [README](./README.md) covers current usage; this file is the "how we got here" record — what was added, what gaps were closed, and what's still known to be missing at each point.

## Phase 2 additions

- **Component router** (`ComponentRegistry.ts`) — buttons/select menus/modals auto-load from `src/components/**` and dispatch by customId (exact match, or prefix match for namespaced ids like `guvenlik:koruma`)
- **Security Center is fully clickable**: Koruma / Tehditler / Loglar / Ayarlar / İstatistik / Sistem buttons all render real, DB-backed panels
- **`koruma:toggle` select menu** — turns any protection module on/off per guild, permission-gated (Manage Guild)
- **`dil:sec` select menu** — saves the user's language preference
- **Whitelist modal** — "Whitelist Ekle" button opens a Zod-validated Discord ID input, writes to `Whitelist`
- **`/koruma`** — standalone command for the same protection panel
- **`/ayarlar log-kanali|alert-kanali|goster`** — configure and inspect log/alert channels and current settings

## Phase 3 additions

- **Canvas rendering** — `SecurityReportCanvas.ts` (the İstatistik panel now attaches a real PNG report) and `ThreatCardCanvas.ts` (every HIGH/CRITICAL alert embed now attaches a threat card image), both pure `canvas` draws with no external assets
- **Moderation commands**: `/uyar`, `/sustur` (timeout, capped at Discord's 28-day max), `/at`, `/yasakla` — each checks `moderatable`/`kickable`/`bannable` before acting, logs to `Punishment` via a shared `ModerationService`, and posts to the configured log channel
- **`/kullanici`** — per-user security profile: account age, join date, whitelist status, triggered security-event count, last 5 punishments
- **`/loglar`** — recent `SecurityEvent` feed as a slash command (previously only reachable via the Security Center button)

## Phase 4 additions

- **Backup / Restore** (`/yedek olustur|listele|geri-yukle`) — snapshots roles, categories, and channels to MongoDB; restore is **additive only** (skips anything that already exists by name, never deletes), and always requires an explicit Onayla/İptal button confirmation before touching the server
- **Whitelist removal** — "Whitelist Çıkar" button + modal alongside the existing "Whitelist Ekle", so entries can be added and removed without touching the database directly
- **`/acil-durum`** (Emergency Mode) — toggles a guild flag that makes `ResponseEngine` escalate MEDIUM threat signals to HIGH (tighter response, more alerts) until turned back off; posts to the alert/log channel either way

## Phase 5 additions — edge cases & resilience

- **Double-event protection**: `AuditEngine.isDuplicateEntry()` remembers audit-log entry IDs for 60s; every Anti-Nuke handler (`onChannelDelete/Create`, `onRoleDelete`, `onDangerousRoleCreate`, `onWebhookCreate`) now checks this before counting a hit, so a resent gateway event never double-counts toward a burst threshold or files two `SecurityEvent`s for one real action
- **Emergency Mode now actually tightens detection**, not just severity labels: `middleware/emergencyGuard.ts` gives a cached, fail-closed `isEmergencyMode()` check; Anti-Nuke halves its burst thresholds and Anti-Raid halves its join-burst threshold (and weights new accounts higher) while it's active
- **Unauthorized-access gap closed**: the Security Center message (`/guvenlik`) is visible to the whole channel, but only the six panel buttons were previously permission-checked at the *command* level — any member could click "Tehditler"/"Loglar"/etc. Every panel button now re-checks Manage Guild at click time before showing anything
- **Process-level guards**: `unhandledRejection` and `uncaughtException` are now logged instead of silently crashing the process; `client.on("error"/"shardError"/"warn")` are wired to the logger
- **Test infra fixed for CI**: importing anything that touches `env.ts` (e.g. the logger, used by `AuditEngine`) previously called `process.exit(1)` during `vitest run` because no real Discord/Mongo credentials exist in CI. Added `ayarlar.test.json` with dummy values, loaded automatically when `NODE_ENV=test`, plus new tests for `resolveHandler` (component routing) and `AuditEngine.isDuplicateEntry`

## Phase 6 additions — full 4-language moderation & settings

- **`/uyar`, `/sustur`, `/at`, `/yasakla`, `/kullanici`, `/loglar`, `/ayarlar`, `/yedek`, `/acil-durum`** all now go through `t()` — every user-facing string lives in `locales/{tr,en,de,es}/{moderation,settings}.json`, resolved via `LanguageService.resolveLanguages()` (user override → guild default → Turkish), matching the `common`/`security` namespaces from earlier phases
- **`npm run build` now copies locale JSON into `dist/`** — `t()` reads these files with `fs.readFileSync` at runtime (not `import`), so `tsc` alone wasn't shipping them; `copy-locales` (wired into `build`) fixes that for production. `npm run dev` needs no change since `ts-node-dev` runs straight from `src/`.

## Phase 7 additions — Emergency Mode gets real teeth

- **`AutoProtectionService`**: the one place in the codebase allowed to act automatically against a real member. Triggers only when **CRITICAL severity + Emergency Mode active + a known, non-whitelisted subject** — applies a **10-minute timeout** (never a ban/kick — short and reversible, so a false positive self-corrects instead of requiring manual undo), logs it to `Punishment`, and reports it in the alert embed (`action: "PUNISHED"`)
- Wired into `ResponseEngine.handle()`: for Anti-Nuke-type events the *executor* is timed out; for Anti-Raid-type events (which have no executor — nobody "did" anything, the joiner itself is the signal) the *joining member* is timed out instead
- This finally closes the gap called out in Phase 5/6: Emergency Mode now does more than escalate severity labels — it's the difference between "🚨 Raid koruması artırıldı" being a log line and an actual action
- New tests cover `AutoProtectionService`'s guard clauses (no subject, guild owner, member not fetchable) — the parts that don't require a live Discord connection to verify

## Phase 8 additions — every protection module fully implemented

All nine modules described in the spec are now real detectors wired to live Discord gateway events, not stubs:

- **Anti-Spam** (`messageCreate`): message-burst rate limiting, duplicate-message detection, unsolicited invite links, excessive caps — deletes the offending message on HIGH/CRITICAL
- **Anti-Mention** (`messageCreate`): `@everyone`/`@here` abuse and mass user/role mention spam, tuned independently of Anti-Spam
- **Anti-Webhook** (`messageCreate` for webhook-authored messages): message-flood detection *from* a webhook, complementing Anti-Nuke's existing webhook-*creation*-burst detection
- **Anti-Bot** (`guildMemberAdd` for bot accounts): flags newly-added bots that are young, were granted dangerous permissions, or both
- **Role Protection** (`roleUpdate`): flags a role quietly gaining Administrator/Manage Guild/etc. after the fact (creation/deletion bursts stay Anti-Nuke's job)
- **Channel Protection** (`channelUpdate`): flags renames and `@everyone` permission-overwrite widening on existing channels
- **Server Protection** (`guildUpdate`): flags server name/icon changes and verification-level *lowering*

- **`/koruma` toggle now actually does something**: `middleware/moduleGuard.ts` gives every module a cached, fail-*safe* (defaults to enabled, unlike Emergency Mode's fail-*closed*) check of its `GuildSettings.modules.*` flag — the select-menu toggle built in Phase 2 was previously cosmetic; every module's entry point now respects it
- New test for `isModuleEnabled`'s fail-safe default when the database is unavailable

## Phase 9 additions — CI and a full security self-audit

- **`.github/workflows/ci.yml`**: runs `npm ci`, lint, `vitest run`, and `npm run build` on every push/PR to `main`. This is also the first time this codebase's dependencies actually resolve and its TypeScript actually compiles against them — this container has no network access, so every prior phase was reviewed by careful reading, not a real `tsc`. Treat this workflow's first run as the real verification.
- **`SECURITY_AUDIT.md`**: a self-audit against the spec's own checklist (permission bypass, unauthorized admin action, duplicate interaction, race condition, MongoDB injection, input validation, rate-limit/cooldown bypass, secret exposure, dangerous automatic actions, audit-log uncertainty, memory leaks, API error handling) — states what's covered and where in the code, rather than just asserting "done."
- Closed a gap the audit surfaced while writing it: `RateLimiter.sweep()` and the new `AuditEngine.sweep()` are now wired to a 5-minute `setInterval` in `index.ts`, so the in-memory rate-limit and dedupe maps are actually pruned on a long-running process instead of just being sweep-*capable*.

## Phase 10 additions — the Redis infrastructure gap is closed

The one gap flagged since Phase 5/9 ("single-process rate limiting and dedupe — a Redis-backed implementation would be required for sharded/multi-instance deployments") is now implemented, not just documented:

- **`database/redis.ts`**: lazily connects to `REDIS_URL` if set; exposes `getRedisClient()`/`isRedisAvailable()`. Unset `REDIS_URL` (the default) means this module is never touched — zero behavior change for single-instance deployments.
- **`utils/rateLimiter.ts` rewritten as three classes**: `MemoryRateLimiter` (the original logic, now returning Promises), `RedisRateLimiter` (a per-key sorted-set sliding window — `ZADD` + `ZREMRANGEBYSCORE` + `ZCARD`, with a TTL so an abandoned key expires on its own), and `HybridRateLimiter` — what every module actually calls. Hybrid tries Redis only when it's configured *and* currently connected, and falls back to the in-memory limiter on any error for that one call, logging once instead of throwing. A Redis blip can never take down burst detection.
- **`AuditEngine.isDuplicateEntry` is now Redis-backed the same way**: `SET key 1 EX 60 NX` is exactly the primitive a distributed "have I seen this before" check needs, with the same in-memory fallback on error.
- **Every call site updated to `await`** the now-async `hit()`/`reset()`/`isDuplicateEntry()` — `AntiNukeModule`, `AntiRaidModule`, `AntiSpamModule`, `AntiWebhookModule`.
- Tests updated: `RateLimiter.test.ts` now exercises `MemoryRateLimiter` directly (including a new sweep test); `AuditEngine.test.ts` awaits the async dedupe check. Neither test sets `REDIS_URL`, so both exercise the in-memory fallback path specifically — a real Redis integration test would need a live Redis instance, which this environment can't provide (see "Known remaining gaps" in `SECURITY_AUDIT.md`).
- `moduleGuard`/`emergencyGuard` were **not** changed — they already read from MongoDB (the shared source of truth across any number of instances) with only a 5-second cache in front for read load, so multi-instance consistency there was never actually a gap, just a bounded staleness window.

Running Redis-backed is opt-in: set `REDIS_URL` in `ayarlar.json` for a multi-instance deployment; leave it empty for a single instance and nothing changes.

## Phase 11 additions — commands cleanup, missing `/yardim`, real Redis test coverage

- **`commands/` reorganized**: was 12 folders for 11 commands — almost every folder held exactly one file with the same name as the folder (`guvenlik/guvenlik.ts`, `dil/dil.ts`, `at/at.ts`, ...), plus an inconsistent leftover (`admin/yedek.ts` sat in an `admin` folder while `acil-durum/` and `kullanici/` were each their own top-level folder for no structural reason). Now grouped by actual domain: `security/` (guvenlik, koruma, loglar, acil-durum, yedek), `moderation/` (uyar, sustur, at, yasakla, kullanici), `settings/` (ayarlar, dil), `general/` (yardim). `CommandRegistry.loadCommands()` needed no code change — it already loads every file under every subfolder, so this was a pure reshuffle.
- **`/yardim` is implemented.** It was named in the spec's own command list from the very first message and simply never got built in any earlier phase — a genuine miss, not a documented trade-off. Lists all commands grouped by category, fully localized via the new `general.json` namespace (tr/en/de/es).
- **The Redis *and* MongoDB integration gaps now have a real answer, not just a caveat.** `docker-compose.yml` brings up both locally; `tests/RedisRateLimiter.integration.test.ts` and `tests/MongoDb.integration.test.ts` exercise the real connections (both use `describe.skipIf` so they're a no-op, not a failure, when the live service isn't available). `.github/workflows/ci.yml` now runs real Redis **and** MongoDB service containers and sets the env vars each test needs — so both paths finally get exercised somewhere with real network access, closing the gaps flagged since Phase 5/9.

## Phase 12 — no `.env`, ever; entry point renamed to `wnerdev.ts`

- **Entry point renamed**: `src/index.ts` → `src/wnerdev.ts`. `package.json`'s `main`, `start`, and `dev` scripts all updated accordingly (`node dist/wnerdev.js`, `ts-node-dev ... src/wnerdev.ts`).
- **dotenv is gone.** No `.env`, `.env.example`, or `.env.test` anywhere in this project anymore, and the `dotenv` package was removed from `package.json`. All configuration — **including the bot token** — lives in a plain JSON file at the project root: `ayarlar.json`, read and Zod-validated by `src/config/env.ts`. `ayarlar.example.json` is the tracked template; `ayarlar.json` itself is gitignored so real credentials are never committed; `ayarlar.test.json` (tracked, dummy values only) is used automatically whenever `NODE_ENV=test`.
- A real process environment variable (not a `.env` file — e.g. a CI service container's own env) can still override a value from `ayarlar.json` if present, which is how the CI Redis/Mongo service containers keep working without reintroducing dotenv.
- See "Configuration — `ayarlar.json`, not `.env`" above for the exact file shape and how to set it up.

## What's next (not yet implemented in this scaffold)

Manual admin commands (`/yasakla`, `/at`, etc.) still aren't restricted by Emergency Mode itself — only the automated detection-and-response path gets the auto-timeout. A Redis-backed rate limiter for multi-instance/frequent-restart deployments, and full integration tests against a real (or dockerized) Discord/Mongo instance, remain open.

## Known remaining edge cases (documented, not yet fixed)

- **Bot restart**: rate-limiter burst counters and the audit-entry dedupe cache are in-memory only — a restart mid-burst resets them. Acceptable for Phase 1–6 (a fresh burst will simply need to re-accumulate hits), but a Redis-backed limiter would close this gap for multi-instance or frequently-restarted deployments.
- **Deleted role/channel audit lookups**: Discord's audit log entry for a delete sometimes has a sparse `target` (the object is gone) — `AuditEngine`'s target-matching can miss in that case and fall back to `executorId: null`, which is logged/alerted correctly but without a named executor. This is a Discord API limitation, not a bug, and the code already refuses to guess.
- Emergency Mode now auto-times-out CRITICAL-severity executors/joiners (see Phase 7), but does not yet restrict manual admin commands themselves (e.g. `/yasakla` still works normally, by an admin's own choice, during Emergency Mode) — that's intentional: admins should never be locked out of their own server.

**Note on this environment**: this container has no network access, so dependencies could not be `npm install`-ed or type-checked here — review compiles cleanly by inspection, but run `npm install && npm run build` on your machine before deploying to catch anything a live `tsc` would flag.

