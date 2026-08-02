# Code Review — FocusFlow v1.0.6

> Reviewed: 2 August 2026  
> Scope: JS/TS layer (`src/`, `app/`), Kotlin native services & modules, database layer

---

## 🔴 Critical

### 1. Divergent default settings between `database.ts` and `AppContext.tsx`

Three fields have different defaults in the two files:

| Field | `database.ts` DEFAULT_SETTINGS | `AppContext.tsx` defaultSettings |
|---|---|---|
| `autoCopyToAlwaysOn` | `false` ✅ | `true` ⚠️ |
| `keepFocusActiveUntilTaskEnd` | `false` | `true` |
| `vpnSelfHealEnabled` | *(missing)* | `true` |

The init path uses `withTimeout(dbGetSettings(), 8000, defaultSettings)` — so if the DB times out (OEM process kill during heavy load), the in-memory fallback kicks in and silently re-enables `autoCopyToAlwaysOn`, the exact bug that was fixed in v1.0.4. The fix was applied to `database.ts` but the `AppContext.tsx` fallback object was never updated. `vpnSelfHealEnabled` also has no default when the DB is loaded and merged (it becomes `undefined`) unless the user has already saved settings that include it.

**Files:** `src/data/database.ts` lines 32–79 · `src/context/AppContext.tsx` lines 119–163

---

### 2. `startFocusMode` mutates JS state before the DB write succeeds

```ts
focusActive = true;          // ← JS says "active"
currentTask = task;
// ...
await dbStartFocusSession(session);  // ← if this throws, no DB row exists
```

If `dbStartFocusSession` throws, the module thinks a session is running but there is no row to restore after a reboot. The session becomes unrecoverable silently. The DB write should happen before flipping the in-memory flag, or the flag should be rolled back in a `catch` block.

**File:** `src/services/focusService.ts`

---

## 🟡 Medium

### 3. `_syncGreyoutSchedule` is dead code

`_syncGreyoutSchedule` (AppContext lines 678–688) is fully implemented but never called from `init()`. The init path calls `_recurringSchedulesToGreyoutWindows()` + `GreyoutModule.setSchedule()` inline instead. The dead function and the inline path can drift independently. Either remove the function or replace the inline block with a call to it.

**File:** `src/context/AppContext.tsx`

---

### 4. `ALWAYS_BLOCKED: Set<String> = emptySet()` — dead code

Declared at line 295 of `AppBlockerAccessibilityService.kt` and never referenced anywhere in the 3,557-line file. It signals intent (a hardcoded "never-allow" list as a complement to `NEVER_BLOCK`) but currently does nothing. Either wire it up or remove it to avoid future confusion.

**File:** `AppBlockerAccessibilityService.kt` line 295

---

### 5. `com.android.contacts` in `NEVER_BLOCK` is misclassified

Listed under `"ZTE / Blade — default contacts (dialer link)"` but `com.android.contacts` is the contacts/people app, not a dialer. Blocking it during a session is a valid user choice — it is not emergency-critical. It should be in `BLOCKABLE_AFTER_WARNING` alongside Settings. As-is, users can never block it regardless of their preference.

**File:** `AppBlockerAccessibilityService.kt` line 277

---

### 6. No concurrency guard on settings writes

`dbSaveSettings` does an `INSERT OR REPLACE` with the full serialised settings JSON. If two code paths call `updateSettings` concurrently (e.g. a focus session end races with a VPN toggle), both read the current state, mutate it, then write — and the second write silently overwrites the first. A simple write-serialisation queue or optimistic-lock check would prevent this.

**File:** `src/data/database.ts` → `dbSaveSettings`

---

### 7. OEM package lists maintained in three separate places

Launcher and SystemUI package names are duplicated across `BLOCKABLE_AFTER_WARNING`, `NEVER_BLOCK`, and the `isLauncherPkg` / `isSystemUiPkg` local variables inside `onAccessibilityEvent`. A new OEM addition needs to be added to all three manually. One missed location = silent bypass or missed enforcement. A single OEM registry object referenced from all three sites would fix the maintenance hazard.

**File:** `AppBlockerAccessibilityService.kt`

---

## 🔵 Minor

### 8. `rowToTask` skips validation on `status` and `priority`

`tags` and `reminders` go through `safeJsonParse` with fallbacks, but `status` and `priority` are cast directly:

```ts
status: row.status as Task['status'],
priority: row.priority as Task['priority'],
```

A corrupted or migrated row with an unrecognised status value would pass through silently and could cause UI rendering issues downstream. A whitelist validation with a `'scheduled'` / `'medium'` fallback would be consistent with how the other fields are handled.

**File:** `src/data/database.ts` → `rowToTask`

---

### 9. `_syncDailyAllowance` swallows errors twice

The function has its own internal `try/catch` that logs a warning. Its caller in `init()` also wraps it in `try/catch`. Errors get logged at the inner level and then silently swallowed at the outer level. Either remove the inner `try/catch` (let errors propagate to the caller) or remove the outer one — not both.

**File:** `src/context/AppContext.tsx` lines 612–619

---

### 10. `RETRY_INTERVAL_MS = 150L` vs documentation saying 300 ms

The constant is 150 ms but the class-level docstring and the README both say "300 ms intervals". Since retry timing is documented as a security property (catching apps that relaunch themselves after dismissal), the mismatch could confuse future contributors.

**File:** `AppBlockerAccessibilityService.kt` lines 367–369

---

## Summary

| Severity | Count | Items |
|---|---|---|
| 🔴 Critical | 2 | Default settings divergence, focus state mutated before DB write |
| 🟡 Medium | 5 | Dead code (`_syncGreyoutSchedule`, `ALWAYS_BLOCKED`), contacts misclassification, concurrent settings write race, triplicated OEM package lists |
| 🔵 Minor | 3 | Row status cast, double-swallowed errors, retry interval doc mismatch |

**Highest priority:** Item 1 (default settings divergence) is a latent reversion of the v1.0.4 `autoCopyToAlwaysOn` bug — it can silently re-activate on any device where the DB is slow to open under OEM memory pressure. Item 2 is also worth addressing before the next release since a failed DB write during focus start leaves the app in an inconsistent state across reboots.
