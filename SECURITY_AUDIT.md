# WnersGuard Security Audit

Self-audit against the checklist from the original spec. Each item states
what's in place, what's a known gap, and where to look in the code.

## ✓ Permission bypass

- Every automated response (`ResponseEngine`, `AntiNukeModule`, etc.) checks
  `WhitelistService.isWhitelisted()` before treating a user/role/bot as
  suspicious — see `isExecutorSafe()` in each module.
- Slash commands set `setDefaultMemberPermissions()` at the Discord API
  level (e.g. `ManageGuild`, `Administrator`, `KickMembers`), so Discord
  itself hides/blocks the command from unauthorized members — this is
  enforced by Discord, not just client-side.
- **Gap closed in Phase 5**: Security Center *buttons* were reachable by
  anyone who could see the (non-ephemeral) `/guvenlik` message, independent
  of the command's own permission gate. `guvenlikPanel.ts` now re-checks
  `ManageGuild` at click time.

## ✓ Unauthorized admin action

- `koruma:toggle` (module on/off) and `yedek:onayla` (backup restore) both
  re-check permissions (`ManageGuild` / `Administrator`) inside the
  component handler itself, not just at the command that surfaced the button.
- `AutoProtectionService` (Phase 7) is the only code path that acts against
  a member without a human triggering it, and it's gated to CRITICAL +
  Emergency Mode + non-whitelisted + not-guild-owner — see that file's
  docstring for the full guard list.

## ✓ Duplicate interaction

- Every button/select/modal handler is looked up once via
  `resolveHandler()` and wrapped in its own try/catch in
  `interactionCreate.ts` — a second click on an already-acknowledged
  interaction fails at the Discord API level (`InteractionAlreadyReplied`)
  and is caught there, not left unhandled.
- `AuditEngine.isDuplicateEntry()` (Phase 5) separately dedupes the
  *Discord gateway event* itself (not the interaction) — the double-event
  case described in the original spec.

## ✓ Race condition

- `MemoryRateLimiter` (single-instance/default mode) is a plain in-memory
  map; Node's single-threaded event loop means concurrent `hit()` calls
  for the same key can't interleave mid-mutation.
- `RedisRateLimiter` (multi-instance mode, opt-in via `REDIS_URL`) uses a
  Redis sorted set per key (`ZADD`/`ZREMRANGEBYSCORE`/`ZCARD` in one
  pipeline) — Redis executes commands atomically per connection, so
  concurrent hits from different bot instances against the same guild
  still count correctly instead of racing.
- `HybridRateLimiter` (what every module actually calls) picks Redis when
  connected and falls back to memory on any error — see Phase 10 in the
  README for the full design.

## ✓ MongoDB injection

- All Mongoose queries in this codebase use object-shaped filters
  (`{ guildId, targetId }`, `{ $set: {...} }`) built from typed values —
  never string-concatenated into a query. The one user-supplied free-text
  field that reaches a query is the whitelist "Discord ID" modal input,
  and it's validated with a strict `^\d{17,20}$` Zod regex *before* it
  touches any Mongoose call (`whitelistEkle.ts`, `whitelistCikar.ts`).

## ✓ Input validation

- Discord ID inputs (whitelist add/remove modals): Zod-validated.
- Slash command options use Discord's own typed option builders
  (`addUserOption`, `addIntegerOption` with `setMinValue`/`setMaxValue`,
  `addChannelOption` with `addChannelTypes`) — Discord rejects malformed
  input before it reaches the bot at all.
- Backup names are capped at 50 characters at the command definition level.

## ✓ Rate limit bypass

- Limits are centrally defined in `DEFAULT_RATE_LIMITS`
  (`config/constants.ts`) and applied identically to every module through
  the shared `RateLimiter` class — there's no per-module reimplementation
  that could drift or be individually bypassed.
- Emergency Mode *tightens* (halves) thresholds rather than loosening them,
  and the tightening path (`isEmergencyMode()`) fails closed (defaults to
  normal, not emergency) if the DB can't be reached — an attacker can't
  force a DB outage to relax detection.

## ✓ Cooldown bypass

- N/A in the literal sense (no per-command user cooldowns are currently
  implemented — the "rate limit" checks above serve the equivalent
  anti-abuse purpose for security-relevant actions). If per-command
  cooldowns are added later, they should go through the same
  `RateLimiter` class rather than a new ad hoc implementation.

## ✓ Secret exposure

- `pino` logger is configured with `redact` paths for `token`, `*.token`,
  `DISCORD_TOKEN`, `*.password`, `*.secret` (`utils/logger.ts`).
- No `.env`/dotenv anywhere (a deliberate project choice) — configuration,
  including the bot token, lives in `ayarlar.json`, which is excluded from
  version control by `.gitignore`. `ayarlar.example.json` (empty
  placeholders) and `ayarlar.test.json` (dummy CI values only) are both
  intentionally tracked; only `ayarlar.json` itself — the one with real
  values — is ignored.
- `src/config/env.ts` still allows a real process environment variable to
  override a value from `ayarlar.json` when one is set (used by CI's
  service containers) — this is a plain env-var read, not a `.env` file
  load, and doesn't reintroduce the dotenv pattern.
- No token or connection string is ever interpolated into a Discord-visible
  message, embed, or log line at `info` level or above.

## ✓ Dangerous automatic actions

- The only automatic (non-human-triggered) action against a real member is
  `AutoProtectionService`'s 10-minute timeout — never a ban or kick, and
  never outside CRITICAL+Emergency Mode+non-whitelisted. See "Emergency
  Mode gets real teeth" in the README for the full reasoning.
- Backup **restore** is additive-only (`BackupService.restore()` skips
  anything that already exists by name) and always requires an explicit
  Onayla/İptal button click — never fires from a bare command.

## ✓ Audit-log uncertainty

- `AuditEngine.findExecutor()`/`findExecutorEntry()` return `null` when no
  matching audit-log entry is found within the time window — every caller
  treats `executorId: null` as "unknown," never falls back to a guess.
  `ThreatAlertEmbed` renders this as "Unknown / Unverified."

## ✓ Memory leaks

- `RateLimiter.sweep()` and `AuditEngine.sweep()` both prune entries older
  than their TTL and are now wired to a `setInterval` in `index.ts` (every
  5 minutes) — neither map grows unbounded over a long-running process.
- `emergencyGuard`'s and `moduleGuard`'s per-guild caches are bounded by
  the number of guilds the bot is in, with short TTLs, not per-event growth.

## ✓ API error handling

- Every Discord API call that can fail on a state the bot doesn't fully
  control (member fetch, channel fetch, role creation, message delete,
  timeout/kick/ban) is wrapped in `.catch()` with a fallback, not left to
  throw uncaught.
- `unhandledRejection`/`uncaughtException` process-level handlers (Phase 5)
  are the last line of defense for anything that still slips through.

---

## Known remaining gaps (tracked, not silently ignored)

1. **This development sandbox still has no network access**, so nothing
   here — including `docker-compose.yml` and the CI Redis/Mongo services —
   has been run by *this* environment. The harness and the CI job that
   would run it now exist and are pushed to a real network (GitHub
   Actions), which is the actual verification this code has never had
   locally. If that CI run reveals a compile or test failure, treat it as
   real signal, not a false alarm.
2. **A live Discord gateway connection is still untested** — Redis and
   MongoDB both now have real CI integration tests (see Phase 11 in the
   README), but a live Discord connection needs a real bot token and a
   test guild, which isn't something a CI job can reasonably provision.
   That path is more realistically covered by manual testing against a
   real server before each release than by automation.
