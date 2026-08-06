# Agent Handoff — FocusFlow SP/DB Best-Practices Fixes

## Context
This document records all refactoring work done on the FocusFlow storage layer
(SharedPreferences ↔ SQLite) so the next agent can continue without re-reading
the codebase from scratch.

---

## Work Completed

### Fix #1 — Kotlin key-constant duplication (`SharedPrefsModule.kt`)
**Problem:** `SharedPrefsModule.kt` hardcoded raw string literals for SP keys that
already exist as `const val PREF_*` in `AppBlockerAccessibilityService`'s companion
object. A key rename in the service would silently break the write path.

**What was changed:** 12 raw string literals replaced with their constants:
- `"standalone_block_active"` → `AppBlockerAccessibilityService.PREF_SA_ACTIVE`
- `"standalone_blocked_packages"` → `AppBlockerAccessibilityService.PREF_SA_PKGS`
- `"standalone_block_until_ms"` → `AppBlockerAccessibilityService.PREF_SA_UNTIL`
- `"launcher_lock_during_standalone"` → `AppBlockerAccessibilityService.PREF_LAUNCHER_LOCK_DURING_SA`
- `"launcher_block_uninstall"` → `AppBlockerAccessibilityService.PREF_LAUNCHER_BLOCK_UNINSTALL`
- `"launcher_hidden_packages"` → `AppBlockerAccessibilityService.PREF_LAUNCHER_HIDDEN_PKGS`

Applied in both setter methods (`setStandaloneBlock`, `setLauncherLockDuringStandalone`,
`setLauncherBlockUninstall`, `setLauncherHiddenPackages`) and `getAllEnforcementSettings()`.

**File:** `artifacts/focusflow/android-native/app/src/main/java/com/tbtechs/focusflow/modules/SharedPrefsModule.kt`

---

### Fix #2 — JS-side typed key constants (`SP_KEYS`)
**Problem:** JS/TS callers used raw string literals with `SharedPrefsModule.putString()`
and `SharedPrefsModule.getString()`. A typo produces a silent wrong-key read/write with
no type error.

**What was changed:**
- Added `export const SP_KEYS = { ... } as const` to `SharedPrefsModule.ts` with 9 keys:
  `PRIVACY_ACCEPTED`, `ONBOARDING_COMPLETE`, `DEFENSE_PIN_HASH`,
  `TASK_AWAITING_DECISION`, `NEXT_UPCOMING_NAME`, `NEXT_UPCOMING_START_MS`,
  `DAILY_ALLOWANCE_USED`, `BLOCK_OVERLAY_QUOTES`, `BLOCK_OVERLAY_WALLPAPER`
- Updated imports in 7 files to import `SP_KEYS`:
  `AppContext.tsx`, `BlockedWordsModal.tsx`, `DailyAllowanceModal.tsx`,
  `OverlayAppearanceModal.tsx`, `PinSetupModal.tsx`, `PinRotationModal.tsx`,
  `PinVerifyModal.tsx`
- Replaced all raw string literal call sites with `SP_KEYS.*` constants.

**Note:** `pinReuseTracker.ts` constructs dynamic keys (`pin_reuse_count_*`,
`pin_reuse_date_*`) using a typed `ReuseTrackerKey` union — already typed-safe,
left untouched.

**Files:** `src/native-modules/SharedPrefsModule.ts` + 7 callers above.

---

### Fix #3 — Settings blob schema versioning
**Problem:** Settings are stored as a single JSON blob with no version field. Ad-hoc
migrations were done inline in `dbGetSettings`. Future migrations would be impossible
to audit or apply correctly.

**What was changed:**
- Added `schemaVersion?: number` field to `AppSettings` interface in `types.ts`
  (with migration log comment).
- Added `const CURRENT_SCHEMA_VERSION = 1` constant to `database.ts`.
- Added `schemaVersion: CURRENT_SCHEMA_VERSION` to `DEFAULT_SETTINGS`.
- Extracted the existing `dailyAllowancePackages` migration into a standalone
  `migrateSettings()` function with a versioned `if (version < N)` pattern.
  Future migrations = add `if (version < 2) { ... }` blocks there.
- `dbSaveSettings()` now stamps every blob with `CURRENT_SCHEMA_VERSION` on write,
  so existing unversioned blobs get stamped the next time they are saved.

**Files:** `src/data/types.ts`, `src/data/database.ts`

---

### Fix #4 — DB-first, SP-second write order in `updateSettings`
**Problem:** `updateSettings` awaited `dbSaveSettings` first, then ran SP syncs in
`Promise.all`. If the app was killed between the two, the AccessibilityService kept
enforcing stale config (SP had old values) until the next cold-start re-sync.

**What was changed:** Merged `dbSaveSettings(settings)` into the existing
`Promise.all([...SP syncs...])` so DB and SP writes race concurrently. This closes
the kill-window. Rollback logic (dispatch `prevSettings` on DB throw) is unchanged.

**File:** `src/context/AppContext.tsx` — `updateSettings` callback.

---

### Fix #5 — Missing indexes on `focus_sessions`
**Problem:** `task_id`, `started_at`, and `is_active` are all queried on `focus_sessions`
but no indexes existed. For long-running installs with daily sessions this adds scan cost.

**What was changed:** Three `CREATE INDEX IF NOT EXISTS` statements added to `initSchema()`
(idempotent — safe to run on every open):
- `idx_focus_sessions_task_id ON focus_sessions(task_id)`
- `idx_focus_sessions_started_at ON focus_sessions(started_at)`
- `idx_focus_sessions_is_active ON focus_sessions(is_active)`

**File:** `src/data/database.ts` — `initSchema()`.

---

### Fix #6 — Inconsistent save pattern across specialized setters
**Problem:** `setDailyAllowanceEntries`, `setBlockedWords`, `setRecurringBlockSchedules`,
and `setStandaloneBlock` all did `DB save → dispatch → SP sync` (DB blocks UI; no rollback
on DB failure; wrong priority order for enforcement data). This was inconsistent with
`updateSettings` (optimistic dispatch first, concurrent DB+SP, rollback on DB throw).

**What was changed:** All four setters converted to:
1. Compute `prevSettings` from `stateRef.current.settings`
2. `dispatch` optimistically (UI flips instantly)
3. `await Promise.all([dbSaveSettings, ...SP syncs])` concurrently
4. On catch: `dispatch(prevSettings)` rollback + `logger.warn`

`setStandaloneBlock` also rethrows so callers (e.g. PIN gate rejection) can surface
the error to the user — same as before.

**File:** `src/context/AppContext.tsx` — four callbacks.

---

## Remaining Gaps (Not Yet Fixed)

### Remaining #1 — `EncryptedSharedPreferences` for PIN hash
**What:** `SessionPinModule.kt` stores the focus-session PIN's SHA-256 hash under
`"session_pin_hash"` in plain MODE_PRIVATE SharedPreferences. On a rooted device or
via ADB backup this is directly readable. `EncryptedSharedPreferences` (from
`androidx.security:security-crypto`) is the Android best practice.

**How to fix:**
1. Add `androidx.security:security-crypto` to
   `android-native/app/build.gradle` dependencies.
2. In `SessionPinModule.kt`, replace `getSharedPreferences(PREFS_NAME, MODE_PRIVATE)`
   with `EncryptedSharedPreferences.create(...)` for the PIN-hash key only, OR create
   a separate encrypted prefs file (`"focusday_secure_prefs"`) just for the PIN hash.
3. Add a one-time migration: on first open after the update, read from plain prefs,
   if found write to encrypted prefs and delete from plain prefs.

**Caution:** `EncryptedSharedPreferences` generates a key in the Android Keystore on
first use. On device wipe or Keystore reset the key is lost → encrypted value is
unreadable. Treat a read failure as "no PIN set" and let the user re-set it.

---

### Remaining #2 — `dbGetAllTasks()` is unbounded
**What:** `SELECT * FROM tasks ORDER BY start_time ASC` has no `LIMIT`. Completed/skipped
tasks are pruned at 365 days but `scheduled` tasks are never pruned — a user with many
unresolved tasks over years accumulates an unbounded result set. `AppContext` already uses
`dbGetTasksForDate` for the daily view; `dbGetAllTasks` is only used by backup/export and
the Stats "all tasks" query.

**How to fix:**
- For backup/export callers: stream in batches or accept the full load (exports are
  user-initiated; a large set is expected).
- For the Stats "all tasks" query: add a configurable `LIMIT` (e.g. 2000) with a
  "load more" pattern, OR add a date-range filter consistent with `dbGetTasksInDateRange`.
- Search all callers of `dbGetAllTasks` with: `grep -rn "dbGetAllTasks" src/`.

---

### Remaining #3 — `putString` generic escape hatch has no key validation
**What:** `SharedPrefsModule.putString(key, value)` accepts any arbitrary string key
from JS. There is no enforcement that callers use `SP_KEYS.*`. New code can silently
introduce untracked keys that aren't in `SP_KEYS` or covered by `getAllEnforcementSettings`.

**How to fix (options):**
- **Option A (strict):** Change the TS signature to `putString(key: keyof typeof SP_KEYS_MAP, value: string)` where `SP_KEYS_MAP` maps each constant name to its string. Breaks any caller not using a known key.
- **Option B (lint):** Add an ESLint custom rule or comment convention that flags raw string literals passed to `putString`/`getString`.
- **Option C (audit only):** Periodically grep for `putString\('` and `getString\('` with a raw string (not `SP_KEYS.`) and review. Low-effort, no tooling required.

Option C is enough for a small team; Option A gives compile-time guarantees.

---

## Key Files Reference
```
artifacts/focusflow/
├── src/
│   ├── context/AppContext.tsx          ← all AppContext callbacks (updateSettings, setters)
│   ├── data/database.ts               ← SQLite layer (getDb, runWithDb, initSchema, migrations)
│   ├── data/types.ts                  ← AppSettings interface (schemaVersion added here)
│   ├── native-modules/
│   │   ├── SharedPrefsModule.ts       ← JS bridge + SP_KEYS export
│   │   └── SessionPinModule.ts        ← focus-session PIN bridge (native, not SP_KEYS)
│   ├── components/
│   │   ├── BlockedWordsModal.tsx
│   │   ├── DailyAllowanceModal.tsx
│   │   ├── OverlayAppearanceModal.tsx
│   │   ├── PinSetupModal.tsx
│   │   ├── PinRotationModal.tsx
│   │   └── PinVerifyModal.tsx
│   └── utils/pinReuseTracker.ts       ← dynamic SP keys, typed via ReuseTrackerKey
└── android-native/app/src/main/java/com/tbtechs/focusflow/
    ├── modules/SharedPrefsModule.kt   ← Kotlin SP module (Fix #1 applied here)
    ├── modules/SessionPinModule.kt    ← Kotlin PIN module (PREF_PIN_HASH = "session_pin_hash")
    └── services/AppBlockerAccessibilityService.kt ← PREF_* constants live here
```

## Architecture Invariants (Do Not Break)
- **SP-primary on cold start:** `init()` reads SP before DB and seeds context immediately.
  DB result is merged on top (DB wins on success; SP wins over defaults on timeout).
- **One-time flag backup:** `privacy_accepted` and `onboarding_complete` are backed up
  to SP so they survive an OEM DB wipe.
- **Group A keys** (enforcement-critical) must be written to both DB and SP on every save.
  SP is the source of truth for the AccessibilityService between cold starts.
- **`callNative` swallows SP errors** — SP write failures are logged but never throw.
  Rollback on DB failure is the only JS-side rollback path.
- **Never edit `android/` directly** — all AndroidManifest changes go through
  `artifacts/focusflow/plugins/withFocusDayAndroid.js` (Expo config plugin).
