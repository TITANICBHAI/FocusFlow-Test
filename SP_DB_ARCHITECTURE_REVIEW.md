# FocusFlow — SP + DB Architecture Review
## Comparison Against Android & React Native Best Practices

---

## 1. Overview of What We Have

### Storage layers
| Layer | Technology | Scope |
|---|---|---|
| SharedPreferences (SP) | Android `SharedPreferences` via `ReactMethod` bridge | Group A: enforcement-critical fields Kotlin services read at boot |
| SQLite | Expo SQLite, single `app_settings` JSON blob row | Group C: all other settings; full backup/export source |
| Separate SQLite tables | Expo SQLite, normalised rows | Tasks, FocusSessions, DailyCompletions, stats |

### Cold-start flow (as implemented)
```
1. getAllEnforcementSettings() ← single bridge call, reads all 17 Group A keys from SP
   → dispatch immediately (context seeded with real enforcement config)
2. dbGetSettings() with 8 s timeout
   → if DB responds: merge { ...spSnapshot, ...dbResult } — DB wins field-by-field
   → if DB times out: { ...defaultSettings, ...spSnapshot } — SP wins over empty defaults
3. privacyAccepted / onboardingComplete cross-check via getString()
4. Native sync functions run against the merged settings
```

### Dual-write on every Group A save
All Group A save paths (setStandaloneBlock, setStandaloneBlockAndAllowance, setDailyAllowanceEntries, updateSettings, etc.) write SP first, DB second. DB writes are non-fatal (caught and logged).

---

## 2. What We Do Well (Confirmed Against Best Practices)

### ✅ SP for native-boot-critical state
**Best practice:** Any value that a Kotlin `Service`, `BroadcastReceiver`, or `AccessibilityService` must read before the JS bundle is running belongs in SharedPreferences, not SQLite. SQLite requires the Expo/RN runtime to be warm; SP does not.

**Us:** Group A (standaloneBlockPackages, alwaysOnPackages, dailyAllowanceEntries, systemGuardEnabled, etc.) lives in SP. `AppBlockerAccessibilityService` and `BootReceiver` read only from SP — never from SQLite. Correct by design.

---

### ✅ Single bulk bridge call on startup
**Best practice:** Every `ReactMethod` call crosses the JS↔native bridge. N individual `getString`/`getBoolean` calls at startup = N round-trips, N promise resolutions, N context switches. Batch reads eliminate this.

**Us:** `getAllEnforcementSettings()` reads all 17 Group A keys in one Kotlin call, serialises to a single JSON string, and resolves one promise. Zero overhead compared to 17 individual calls.

---

### ✅ Non-blocking cold start (SP fast-path before DB)
**Best practice:** Never block the UI on an async I/O operation. Dispatch a usable initial state synchronously (or as fast as possible), then patch when the slower source resolves.

**Us:** SP read completes in < 1 ms (in-memory after first read by the OS). DB read has an 8 s timeout. Context is dispatched with real enforcement config before the DB even responds. The user sees a live, correctly-configured app immediately.

---

### ✅ `.apply()` over `.commit()`
**Best practice:** `SharedPreferences.Editor.commit()` is synchronous and blocks the calling thread. `apply()` schedules the write asynchronously and returns immediately. All SP writes should use `apply()` unless the calling thread is already a background thread and the result is critical.

**Us:** Every `prefs().edit()...apply()` in `SharedPrefsModule.kt` — correct.

---

### ✅ SP survives DB file deletion (the whole point)
**Best practice:** On Android, aggressive OEM memory management (MIUI, ColorOS, etc.) can delete app database files from `/data/data/<pkg>/databases/` while leaving SharedPreferences in `/data/data/<pkg>/shared_prefs/` intact. SP is the right resilience layer for this.

**Us:** This is the explicit reason for the SP-primary architecture. The SP backup of `privacy_accepted` and `onboarding_complete` (written in `privacy-policy.tsx` and `user-profile.tsx`) and the SP-primary Group A fields collectively mean the user loses zero enforcement config and does not have to re-accept privacy or redo onboarding after an OEM-triggered DB wipe.

---

### ✅ DB as single export/restore source
**Best practice:** Backup and restore should read from a single, authoritative, complete representation of app state. Splitting backup across SP + DB creates format complexity and version-skew risk.

**Us:** Export always reads from the DB JSON blob (`dbGetSettings()`). Since every Group A save writes DB alongside SP, the DB blob stays in sync. The backup file always has the full canonical state. Correct.

---

### ✅ Non-fatal DB writes on Group A save paths
**Best practice:** For enforcement-critical saves, the primary write (SP) must not be blocked or cancelled by a secondary write (DB) failure. DB errors should be logged and swallowed.

**Us:** All Group A save paths do `try { await dbSaveSettings(...) } catch (e) { logger.warn(...) }` then immediately proceed with the SP write. SP write is never gated on DB success.

---

## 3. Gaps and Risks (Where We Diverge from Best Practices)

### ⚠️ SharedPreferences vs Jetpack DataStore
**Best practice (Google, 2020+):** `SharedPreferences` is officially in maintenance mode. Google's recommended replacement is [Jetpack DataStore](https://developer.android.com/topic/libraries/architecture/datastore), which offers:
- Coroutine-based async API (no ANR risk from `commit()`)
- Type safety via Protocol Buffers (Proto DataStore) or typed keys (Preferences DataStore)
- Safe concurrent access (Flow-based reads, no race conditions on parallel writes)
- Crash-safe atomic writes backed by transactions

**Us:** Standard `SharedPreferences` with `apply()`. The `apply()` usage means the ANR risk is mitigated, and since we only write from the JS bridge (single-threaded RN executor), concurrent write races are not a practical concern. Migration to DataStore would require rewriting all Kotlin read sites and the JS bridge — a large refactor for marginal gain given our single-writer pattern.

**Risk level:** Low. Not a real problem given our usage pattern, but worth flagging for future architecture decisions.

---

### ⚠️ SP file size — JSON arrays in SharedPreferences
**Best practice:** SP is optimised for small primitives and short strings. The entire SP file is loaded into memory on first access and kept there. Large values (multi-KB JSON arrays) inflate the in-memory footprint of the SP file and slow down every subsequent SP read in the process.

**Us:** Several Group A values are JSON arrays stored as strings:
- `daily_allowance_config` — a full `DailyAllowanceEntry[]` (could be 10–50 entries × ~100 bytes each)
- `standalone_blocked_packages` — potentially dozens of package names
- `always_block_packages` — same
- `blocked_words` — user-defined keyword list

**Risk level:** Moderate for power users. If `daily_allowance_config` grows to 50 entries or `blocked_words` to 200 words, the SP file could approach 30–50 KB. Not dangerous but not ideal. Best practice would be to move large arrays to a separate compact binary store or a dedicated lightweight SQLite table the Kotlin services can read directly.

---

### ⚠️ Single JSON blob for app_settings in SQLite
**Best practice:** SQLite's strengths are normalised tables, indexes, atomic multi-row transactions, and SQL queries. Storing a single JSON blob in a single row uses SQLite as a key-value store, which:
- Eliminates indexing (no field-level queries)
- Breaks migrations (no ALTER TABLE per field — the whole blob is re-serialised)
- Makes it impossible to diff or audit individual field changes
- Defeats foreign-key relationships

**Us:** `app_settings` is one row, one `value` column, one JSON string. Tasks, FocusSessions, and DailyCompletions are normalised — correctly so. The settings blob is acceptable for a mobile app settings store where the entire object is always read/written atomically, but it is not idiomatic SQLite.

**Risk level:** Low for current scale. If settings ever need server sync, partial updates, or per-field audit logging, the blob becomes a blocker.

---

### ⚠️ No SP write ordering guarantee across JS and Kotlin writers
**Best practice:** When multiple writers (JS bridge + direct Kotlin code) can write to the same SP file concurrently, access must be serialised or conflicts handled.

**Us:** JS writes via `ReactMethod` (executed on the RN JS thread) and Kotlin services write SP directly (e.g., `AppBlockerAccessibilityService` writing daily allowance usage counters). Both write to the same SP file. Android's `apply()` uses a lock internally, so individual key writes are atomic — but a read-modify-write sequence (e.g., read `daily_allowance_used`, increment, write) is not atomic across threads.

**Risk level:** Low-medium. The Kotlin services write usage counters; the JS bridge writes config. There is no current read-modify-write overlap between the two writers on the same key. If that ever changes, a race condition could silently corrupt usage counters.

---

### ⚠️ DB merge on cold start trusts entire DB blob as "DB wins"
**Best practice:** When merging two sources of truth, the merge strategy should be field-level, not source-level, whenever field timestamps or version vectors are available.

**Us:** Our merge is `{ ...spSnapshot, ...rawSettings }` — the entire DB blob wins over the entire SP snapshot for all Group A fields simultaneously. This means:
- If one Group A field is stale in DB (e.g., DB was restored from a backup from 2 days ago), it silently overwrites the fresher SP value for that field.
- There is no per-field last-write timestamp to resolve conflicts correctly.

**Risk level:** Low in practice (the backup/restore flow also writes SP so timestamps align), but the architecture is not formally correct. A robust implementation would store a monotonic version counter per Group A field.

---

## 4. Summary Table

| Practice | Status | Notes |
|---|---|---|
| SP for boot-time Kotlin state | ✅ Correct | Exactly the right layer |
| Single bulk bridge read on startup | ✅ Correct | `getAllEnforcementSettings()` |
| Non-blocking cold start | ✅ Correct | SP fast-path before DB |
| `apply()` not `commit()` | ✅ Correct | All write sites |
| SP survives OEM DB wipe | ✅ Correct | Entire purpose of architecture |
| One-time flag SP backup | ✅ Correct | privacy + onboarding, all paths covered |
| DB as backup/export source | ✅ Correct | Single blob kept in sync |
| Non-fatal DB writes on critical saves | ✅ Correct | Logged, never blocking |
| Jetpack DataStore (modern replacement for SP) | ⚠️ Not used | Low risk given single-writer pattern |
| SP file size (large JSON arrays) | ⚠️ Watch | Could inflate for power users |
| Single JSON blob in SQLite | ⚠️ Not idiomatic | Acceptable for settings; bad for future scale |
| Concurrent SP writer safety | ⚠️ Partial | No overlap today; fragile if Kotlin adds RMW on config keys |
| Per-field merge timestamps | ⚠️ Missing | Whole-blob "DB wins" is coarse |

---

## 5. Recommended Future Hardening (Priority Order)

1. **Cap SP array sizes** — Add a UI/validation cap on `blockedWords` (e.g., max 100) and `dailyAllowanceEntries` (e.g., max 30). Document the SP size implication in code comments. Prevents the SP file from bloating silently.

2. **Consider DataStore for new Group A fields** — Any future enforcement field added to the Kotlin layer should be evaluated for DataStore (Preferences DataStore) rather than adding more keys to the plain SP file. No need to migrate existing fields.

3. **Per-field version counter for DB/SP merge** — Long-term: add a `settings_version` map (field → monotonic integer) written alongside every save, stored in both SP and DB. Merge becomes field-level winner-by-version rather than whole-blob DB-wins.
