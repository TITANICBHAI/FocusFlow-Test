# FocusFlow Persistence and Startup Reliability Plan

## Status

- **Document type:** implementation plan and acceptance contract
- **Scope:** FocusFlow Android mobile artifact under `artifacts/focusflow/`
- **Primary goal:** stop transient persistence failures from appearing as an empty or reset user account
- **Secondary goal:** establish one canonical owner for durable app data without loading every task into memory
- **UI strategy:** keep the existing Expo/React Native UI during the first migration; do not combine this work with a full Compose UI rewrite
- **Database direction:** move canonical Android data ownership from the JavaScript Expo SQLite layer to a native Room-backed repository, in stages
- **Current implementation status:** planning only; no migration implementation is authorized by this document
- **Role:** supporting long-term Room/repository reference; use `PERSISTENCE_MIGRATION_PLAN.md` as the immediate execution guide through Phase 4

This document is authoritative for the FocusFlow persistence migration. `FINAL_PLAN.md` remains authoritative for the already-scoped UsageStats, fallback-enforcement, screen-off allowance, and overnight-greyout work. `KOTLIN_MIGRATION.md` describes a possible complete React Native-to-Compose rewrite, but that full UI rewrite is explicitly outside the first persistence migration.

---

## 1. Problem Statement

### 1.1 User-visible failure to eliminate

The user may open FocusFlow and see a database error, an empty task list, default settings, or an otherwise uninitialized-looking app. If the user waits and opens the app again without changing anything, the application may work normally.

The implementation must treat this as a reliability problem with two possible classes of cause:

1. **Transient availability failure**
   - stale or dead SQLite handle;
   - startup race;
   - concurrent background/headless database access;
   - temporary database lock;
   - native module initialization timing;
   - Android process/service lifecycle overlap.

2. **Persistent data/storage failure**
   - malformed JSON or row data;
   - failed or partial schema migration;
   - damaged database file;
   - filesystem failure;
   - incompatible schema;
   - unrecoverable native database exception.

The current app does not reliably distinguish these classes. It often turns a read failure into an empty array, zero, default settings, or a fresh recovery database. That is not acceptable because a technical failure must never be represented as “the user has no data.”

### 1.2 Correct interpretation of “it comes back later”

The fact that the app works after waiting does not prove that the database file was corrupted. It is consistent with a temporary lock, dead handle, startup race, or a competing background operation ending.

The plan must therefore:

- retry bounded transient failures;
- preserve the primary database;
- never silently activate an empty database;
- expose a truthful error if retry and repair cannot succeed;
- and record enough diagnostic detail to distinguish the failure class later.

Room and native ownership should reduce the occurrence of this problem, but the startup state machine and failure semantics are just as important as the database library.

---

## 2. Confirmed Current Architecture

The following is the baseline to preserve and verify before implementation. If the current checkout differs from this list, the implementation agent must update this plan or add a verified note before editing. Do not assume an older audit is correct.

### 2.1 JavaScript/Expo persistence

Primary source files:

- `artifacts/focusflow/src/data/database.ts`
- `artifacts/focusflow/src/data/types.ts`
- `artifacts/focusflow/src/data/defaultSettings.ts`
- `artifacts/focusflow/src/context/AppContext.tsx`
- `artifacts/focusflow/src/services/focusService.ts`
- `artifacts/focusflow/src/tasks/backgroundTasks.ts`
- `artifacts/focusflow/src/services/backupService.ts`

Observed responsibilities:

- Expo SQLite stores tasks, settings, focus sessions, overrides, streak/completion data, statistics-related data, and pruning data.
- Settings are currently represented as a large JSON value rather than a fully normalized typed settings model.
- `database.ts` contains a database singleton, single-flight open behavior, a JavaScript write queue, retry behavior, WAL/busy-timeout setup, and a recovery-database path.
- Some read helpers return safe-looking empty/default values after failure.
- `AppContext` maintains a second in-memory representation of task, settings, and focus state.
- Background/headless handlers can access persistence without the React UI being active.
- Backup export/import has its own persistence behavior and must not treat an unavailable database as an empty valid database.

### 2.2 Native Android persistence

Primary source files:

- `artifacts/focusflow/android-native/app/src/main/java/com/tbtechs/focusflow/modules/SharedPrefsModule.kt`
- `artifacts/focusflow/android-native/app/src/main/java/com/tbtechs/focusflow/services/AppBlockerAccessibilityService.kt`
- `artifacts/focusflow/android-native/app/src/main/java/com/tbtechs/focusflow/services/ForegroundTaskService.kt`
- `artifacts/focusflow/android-native/app/src/main/java/com/tbtechs/focusflow/services/NetworkBlockerVpnService.kt`
- `artifacts/focusflow/android-native/app/src/main/java/com/tbtechs/focusflow/widget/FocusFlowWidget.kt`
- `artifacts/focusflow/android-native/app/src/main/java/com/tbtechs/focusflow/services/TemptationLogManager.kt`

Observed responsibilities:

- Android services need native-readable state when React Native is not running.
- SharedPreferences currently stores focus state, active-task data, allowed packages, standalone block, always-on block, allowance configuration and usage, blocked words, VPN settings, launcher settings, overlay settings, and widget data.
- Related values are sometimes written in multiple independent preference operations.
- Several structured values are stored as JSON strings.
- Temptation events are currently stored as a capped JSON array in SharedPreferences.
- The Accessibility Service, foreground service, VPN service, boot paths, notification paths, and widget can read or mutate native state independently.

### 2.3 AsyncStorage and filesystem

Observed responsibilities:

- `setupPersistence.ts` mirrors onboarding/privacy/protection state into SharedPreferences and AsyncStorage.
- `startupLogger.ts` stores diagnostic information in AsyncStorage and in a document-directory file.
- `backupService.ts` uses a user-selected file for backup/export/import.

These mechanisms are not suitable replacements for the canonical task database. They may remain for non-critical diagnostic or UI-only data, but they must not be used as a silent user-data recovery database.

### 2.4 React in-memory state

`AppContext` is a UI cache and orchestration layer. It must not remain a second durable owner after the migration.

The React cache may contain:

- the currently displayed task slice, normally today’s tasks;
- the current active session;
- a settings snapshot used by the visible UI;
- transient loading/error state;
- optimistic interaction state only when the command result is reconciled.

It must not contain the entire historical task database as a routine startup cache.

---

## 3. Non-Negotiable Invariants

Every implementation phase must preserve these invariants.

### 3.1 Data truth

1. A database read failure is not an empty result.
2. A settings read failure is not the default settings object.
3. A failed write is not a successful command.
4. A failed native synchronization is not reported as active enforcement.
5. The primary database is never replaced by a newly created empty database without explicit repair/migration logic.
6. The app must never silently choose between two live databases.

### 3.2 Ownership

1. Durable product data has one canonical owner.
2. The native enforcement snapshot is a cache/replica with a revision, not a second product database.
3. React state is a presentation cache.
4. AsyncStorage and diagnostic files are not fallback stores for tasks, settings, sessions, or history.
5. Background and notification code uses the same command/repository rules as the foreground UI.

### 3.3 Query scope

1. The database stores all task history required by the product.
2. Normal startup loads only the data required by the current screen.
3. The normal Schedule screen loads today’s task slice, plus overdue items only if that is already part of the current product behavior.
4. Historical screens use pagination or bounded date ranges.
5. Statistics use database aggregation queries rather than loading all historical tasks into React.
6. Full-database reads occur only for explicit backup/export, migration, repair, or administrator-level diagnostics.

### 3.4 Recovery

1. Transient errors are retried with a bounded policy.
2. Persistent errors are visible and actionable.
3. Recovery never destroys the original database.
4. Migration can be resumed or safely restarted.
5. Import is validated before it becomes active.
6. A repair attempt records what it did and what it could not recover.

### 3.5 Enforcement safety

1. Native blocking must not claim that a rule is active until its required snapshot is published successfully.
2. If the native snapshot is stale, the service must know that it is stale.
3. Enforcement must fail closed or fail open according to the existing product safety policy for that specific rule; the implementation agent must not invent a new policy silently.
4. A service restart, process death, or boot must reconcile native state from the canonical repository/snapshot.

---

## 4. Target Architecture

### 4.1 Canonical durable store

Introduce a native Room-backed database for the Android app.

Room is the target because the Android enforcement layer already exists in Kotlin and requires access when JavaScript is unavailable. Room should provide:

- typed entities and DAOs;
- explicit schema versions;
- transactional migrations;
- foreign-key relationships;
- unique constraints;
- affected-row checks;
- suspend/coroutine access;
- testable repositories;
- and native access from background receivers and services.

Room is not a reason to rewrite the UI. The existing React Native UI should initially call a native repository bridge or a compatibility adapter.

### 4.2 Repository and command layer

Create one native persistence boundary. The exact class names may differ, but the boundary must provide equivalent responsibilities:

```text
TaskRepository
SettingsRepository
FocusSessionRepository
AllowanceRepository
ScheduleRepository
StatsRepository
BackupRepository
EnforcementStateRepository
```

Repositories must not be independent competing stores. They may be separate classes, but related operations must compose through one database transaction boundary.

Commands must return explicit results. The result shape must distinguish:

```text
success
validation failure
conflict / stale revision
database unavailable
database corrupted or migration failed
native snapshot publication failed
```

Do not return `null`, empty arrays, zero, or default settings as an error substitute.

### 4.3 Native enforcement snapshot

Keep a small, versioned native snapshot for fast service reads. It should contain only runtime enforcement data, such as:

- snapshot schema version;
- monotonically increasing revision;
- publication timestamp;
- current focus mode;
- active task identifier and planned end time;
- allowed package set for the active mode;
- standalone-block state and expiry;
- always-on state and package set;
- VPN mode and package set;
- daily-allowance configuration/checkpoint required by enforcement;
- blocked-word data required by the native service;
- system-control/launcher/overlay protection state;
- and a checksum or equivalent integrity marker.

The snapshot must be serialized and published as one logical record. Do not continue adding unrelated preference keys to the snapshot.

SharedPreferences may temporarily store this snapshot because native services need a fast synchronous read. It must be treated as a cache, not as the canonical source. The snapshot must carry its revision so services can detect stale data.

### 4.4 AsyncStorage and files after migration

Allowed uses:

- dismissible UI hints;
- non-critical onboarding display state if it is not authoritative;
- diagnostic logs;
- user-reviewed export files;
- migration reports;
- temporary repair artifacts.

Disallowed uses:

- task recovery;
- settings recovery;
- focus-session recovery;
- allowance usage recovery;
- silent database fallback;
- or authoritative enforcement state.

### 4.5 React Native compatibility layer

During the first migration, keep the existing screens and route their data operations through a compatibility adapter.

The adapter may expose the current TypeScript-facing functions, but those functions must delegate to native commands rather than continue writing Expo SQLite after the switch.

The adapter must:

- preserve existing UI data types where possible;
- map native error results into explicit UI states;
- invalidate/refetch the relevant query after a successful command;
- never update React state as a durable success before the native command succeeds;
- and provide a migration flag/status to the UI.

---

## 5. Startup Reliability Contract

### 5.1 Required startup state machine

The app must have an explicit persistence state machine equivalent to:

```text
NOT_STARTED
  -> OPENING
  -> HEALTH_CHECKING
  -> MIGRATING
  -> READY

OPENING / HEALTH_CHECKING
  -> RETRY_WAIT
  -> READY
  -> RECOVERABLE_ERROR
  -> CORRUPT_OR_MIGRATION_ERROR

READY
  -> RECONCILING_NATIVE_STATE
  -> READY
  -> DEGRADED_READ_ONLY

RECOVERABLE_ERROR
  -> RETRY_WAIT
  -> OPENING
  -> REPAIR_UI

CORRUPT_OR_MIGRATION_ERROR
  -> REPAIR_UI
  -> RESTORE_UI
  -> READ_ONLY_DIAGNOSTICS
```

The names may be implemented differently, but the semantics are required.

### 5.2 Retry behavior

For transient open/lock/handle errors:

1. Attempt the normal open.
2. Run a health check.
3. Retry a small, bounded number of times with increasing delays.
4. Recreate only the invalid in-memory/native handle if the error indicates a dead handle.
5. Do not delete, rename, or replace the database during ordinary retry.
6. Do not open `focusday_recovery.db` as the active user database.
7. After the retry budget is exhausted, transition to a visible error state.

The retry policy must be centralized. Individual database helpers must not each implement unrelated retry loops.

### 5.3 Health check

A successful open is not enough. The health check must verify, using the capabilities of the selected database implementation:

- the expected schema version;
- required tables/columns;
- a lightweight read from the settings metadata;
- a lightweight read from the task metadata;
- foreign-key integrity where enabled;
- and SQLite quick-check/integrity-check behavior where available and appropriate.

Health-check failures must identify whether the problem is:

- missing schema;
- unsupported migration;
- malformed data;
- lock/unavailable;
- or integrity failure.

### 5.4 UI behavior during startup

While persistence is `OPENING`, `HEALTH_CHECKING`, or `RETRY_WAIT`:

- show a loading state;
- do not render default settings as if they were loaded;
- do not show “No tasks today” as a confirmed empty state;
- disable mutating controls;
- do not start a focus session;
- do not schedule or cancel user reminders based on incomplete data.

If a previous valid today-task cache is available, it may be shown as **stale/read-only** with a visible indicator. It must not be presented as current database truth.

### 5.5 UI behavior after failure

For `RECOVERABLE_ERROR`:

- show the failure category in plain language;
- offer Retry;
- preserve diagnostics;
- keep mutations disabled;
- do not clear React state automatically.

For `CORRUPT_OR_MIGRATION_ERROR`:

- offer Repair/Restore/Export diagnostics;
- preserve the original database;
- explain that no data was deleted;
- do not create an empty replacement and continue silently.

### 5.6 No false readiness

Any watchdog or timeout in `AppContext` must not force the app into a ready state merely because startup took too long.

Timeout means:

```text
startup did not finish within the expected time
```

It does not mean:

```text
the database is empty and the app can continue normally
```

---

## 6. Data Model and Ownership Requirements

The exact columns must be derived from the current schema and `src/data/types.ts`. The agent must inspect the current definitions before creating entities. The following are required data concepts, not permission to invent replacements or discard existing fields.

### 6.1 Task data

Preserve every current task property, including as applicable:

- stable task ID;
- title;
- description/notes;
- start/end or scheduled date/time;
- duration;
- priority;
- tags;
- status;
- completion/skip timestamps;
- focus-mode flag;
- allowed package list;
- recurring/schedule linkage;
- creation/update timestamps;
- and any fields used by backup/import or statistics.

Required database behavior:

- stable IDs must survive migration;
- task status transitions must be validated;
- date/time values must preserve the existing timezone semantics;
- updates must report whether a row was actually changed;
- deletes must not silently remove related focus/session history;
- task lists must have indexes for the normal date query and status query.

### 6.2 Focus sessions

Preserve:

- session ID;
- task ID when present;
- standalone versus task-linked type;
- start time;
- planned end time;
- actual end time;
- stop reason/status if present;
- override records;
- and any fields used by reports.

Required constraints:

- there must not be two simultaneously active sessions unless the product explicitly supports that;
- start/stop/extend operations must be idempotent for notification retries;
- ending a session and clearing active native state must be a coordinated command;
- task/session status must not be updated in separate unrelated UI operations.

### 6.3 Settings

Preserve all settings currently exposed by `AppSettings` and related types, including:

- notifications;
- scheduling defaults;
- focus behavior;
- aversion deterrents;
- allowance configuration;
- blocked words;
- greyout schedules;
- overlay appearance;
- launcher settings;
- VPN settings;
- system-control protection;
- privacy/onboarding state where applicable;
- profiles/presets;
- and any imported settings.

Settings should be represented as:

- typed columns/tables for values that are queried by native enforcement or scheduling;
- structured child tables for repeatable data such as package rules, blocked words, and greyout windows;
- JSON only for genuinely flexible appearance or extension data, with schema validation.

Do not preserve the single giant JSON blob merely because it is convenient. If a flexible JSON field remains, it must have:

- a version;
- validation;
- a migration path;
- and an explicit error when malformed.

### 6.4 Allowances

Daily allowance configuration and usage must be separate concepts:

```text
allowance rule:
  package
  mode
  limit
  enabled
  schedule/validity if currently supported

allowance usage:
  package
  local date or usage window
  count
  used milliseconds
  interval/window fields if currently supported
  last updated timestamp
```

Usage updates must be atomic and must not be implemented as unprotected JSON read-modify-write.

The implementation must preserve the existing count, time-budget, and interval semantics. `FINAL_PLAN.md` remains authoritative for current enforcement and UsageStats correctness.

### 6.5 Temptation events and reports

Move temptation events from the SharedPreferences JSON array into a bounded database table.

Required behavior:

- each event has a stable ID or idempotency key;
- package name, display name if stored, timestamp, and related session information are preserved;
- the 500-entry cap is enforced transactionally;
- weekly reports aggregate from the table;
- report generation does not require loading all events into the UI;
- clearing the report history is an explicit destructive action.

### 6.6 Schedules, reminders, and alarms

The database stores the desired schedule/reminder state. Android AlarmManager/WorkManager state is an external runtime projection and can be lost or canceled by the OS.

Required behavior:

- store stable reminder/job identifiers;
- make notification scheduling idempotent;
- reconcile scheduled jobs on app startup and boot;
- do not create duplicate alarms after repeated retries;
- do not delete database data merely because an OS alarm is missing;
- and do not claim a reminder is scheduled until the platform operation succeeds or the app records a recoverable pending state.

The implementation must inspect the existing scheduler and notification code before choosing whether reminders are represented as one row per task or another structure.

---

## 7. Task Query Policy

### 7.1 Canonical storage versus routine reads

All tasks remain in the canonical database. The app must not load all tasks during normal launch.

This is the intended split:

```text
canonical database:
  all tasks, historical records, schedules, sessions, and reports

normal Schedule screen:
  today's tasks and explicitly defined overdue items only

Focus screen:
  active session and active task only

Stats screen:
  aggregate SQL queries and bounded report rows

History/search:
  paginated or bounded-range queries

Backup/migration:
  deliberate full read, outside normal UI startup
```

### 7.2 Required query contracts

The native repository or compatibility adapter must provide equivalent operations to:

```text
getTodayTasks(localDate, includeOverduePolicy)
getTasksForDateRange(startLocalDate, endLocalDate, page)
getTaskById(taskId)
getActiveTask()
getActiveFocusSession()
getTaskHistoryPage(cursor, pageSize, filters)
getStatsSummary(range)
getTemptationSummary(range)
exportAllData()
```

The exact function names may differ. The distinction between bounded reads and explicit full export must remain.

### 7.3 Today-only behavior

The implementation must preserve the current product behavior for the Schedule screen:

- load today’s rows;
- include overdue rows only if the existing UI/business logic currently includes them;
- do not silently change the definition of “today”;
- use the device-local timezone consistently;
- refresh when the local date changes;
- and avoid loading historical rows merely to render today.

If recurring schedules are calculated dynamically, query only the schedule definitions needed for the selected day. If recurring instances are already materialized as task rows, preserve that behavior and query the relevant date index. The agent must inspect `schedulerEngine.ts` and the current schema before deciding.

### 7.4 Caching

The normal in-memory cache should be keyed by:

```text
query type + local date/range + filter + canonical revision
```

After a successful mutation:

- invalidate the affected query;
- refetch or apply the command result;
- update the active-session and enforcement projections if relevant.

Do not maintain an unbounded “all tasks” React cache.

---

## 8. Transaction and Concurrency Rules

### 8.1 Native transaction boundary

The following operations must be native transactions or equivalent atomic repository commands:

- create/update/delete task with related schedule/reminder metadata;
- complete/skip task with completion/streak-derived data;
- start focus session;
- stop focus session;
- extend focus session;
- emergency override;
- update allowance usage;
- clear all tasks with required focus cleanup;
- import/restore;
- settings updates that affect multiple enforcement domains.

The existing task-deletion rule must remain: clearing tasks ends active focus sessions before deleting task rows and does not alter block settings.

### 8.2 Idempotency

Notification actions, headless tasks, boot recovery, and service callbacks can be delivered more than once.

Each retryable command must use at least one of:

- stable action/event ID;
- session ID plus operation type;
- monotonic state transition;
- expected revision;
- unique database constraint;
- or an equivalent duplicate guard.

Examples:

- pressing Complete twice must not create two completion records;
- processing the same overrun notification twice must not extend or skip twice;
- starting the same session retry must return the existing session rather than create another;
- boot reconciliation must not duplicate alarms or sessions.

### 8.3 Revision and stale UI

Commands that can race with another writer should accept or check a revision/version.

If the UI is stale:

- reject with a conflict, or
- rebase using the current canonical row according to a documented rule.

Do not silently overwrite newer native/background changes with an old React state copy.

### 8.4 Native snapshot publication

Room and SharedPreferences/file publication cannot be one physical transaction. Use a revisioned projection protocol:

1. Commit canonical data in Room.
2. Build the enforcement snapshot from the committed state.
3. Publish the snapshot atomically as one logical record.
4. Mark the snapshot revision as current.
5. Start/refresh native services only after publication succeeds.
6. If publication fails, record a pending reconciliation and return a non-success or degraded result.
7. On next startup, boot, or service reconnect, rebuild the snapshot from Room.

A failed snapshot publication must never be hidden as a successful focus/block command.

---

## 9. Migration from Expo SQLite

### 9.1 Migration safety rules

The old Expo database must be treated as valuable user data.

Before switching:

- do not delete it;
- do not overwrite it;
- do not rename it until the migration is verified;
- do not create an empty database with the old production name;
- do not migrate from a recovery database without explicit user-visible selection;
- and preserve a backup or repair copy using a supported method.

### 9.2 Pre-migration inventory

Before implementing entities or import code, inspect and record:

- actual database filename and location;
- actual schema creation/migration code;
- `PRAGMA user_version` behavior;
- every table and column;
- indexes and constraints;
- JSON fields and their formats;
- task status values;
- date/time formats and timezone assumptions;
- IDs and foreign-key relationships;
- current backup format;
- all database call sites, including headless/background code;
- and every SharedPreferences key that duplicates product state.

This inventory must be checked against the current checkout, not copied blindly from `AUDIT.md` or the older full-rewrite document.

### 9.3 Migration states

Persist migration progress outside the old active database or in a separate migration metadata area. Required states are equivalent to:

```text
NOT_STARTED
PREPARING
SOURCE_VALIDATED
IMPORTING
IMPORTED_UNVERIFIED
VERIFIED
SWITCHED
FAILED_RETAIN_SOURCE
```

The migration must be restartable. If it stops during import, discard only the incomplete target database and restart from the untouched source. Never continue with a partially imported target as if it were complete.

### 9.4 Import algorithm

Use this order:

1. Stop or pause user mutations and background database writers.
2. Record the app version, source schema version, and migration start time.
3. Ensure the old source database is closed/quiescent.
4. Create a protected source backup or export using a supported API.
5. Open and validate the source.
6. Create the new Room schema in a separate database.
7. Import metadata and settings with validation.
8. Import tasks and schedule data while preserving stable IDs.
9. Import focus sessions, overrides, completions, allowance rules/usage, reports, profiles, presets, and other supported data.
10. Import or transform temptation history according to the confirmed current format.
11. Import backup-compatible fields that are not currently visible in the UI; do not drop them because they are not currently displayed.
12. Commit imports in controlled transactions.
13. Run target integrity checks.
14. Compare source and target counts, IDs, date ranges, and important totals.
15. Record malformed rows or fields in a migration report.
16. Do not switch unless all required checks pass.
17. Mark the migration `VERIFIED`.
18. Switch the compatibility adapter to the native repository.
19. Rebuild and publish the native enforcement snapshot.
20. Reconcile reminders, foreground service state, VPN state, widget state, and boot state.

### 9.5 Verification requirements

At minimum compare:

- task count;
- task ID set;
- status counts;
- task date minimum/maximum;
- active session count;
- focus session count;
- override count;
- settings key/category set;
- allowance rule count;
- allowance usage date/package set;
- blocked-word count;
- greyout-window count;
- profile/preset count;
- temptation event count up to the configured cap;
- and backup/import metadata.

Count equality alone is insufficient. Compare IDs and representative field values, including timestamps, package names, statuses, durations, enabled states, and malformed/optional values.

### 9.6 Switch and rollback

The switch must be reversible during the migration rollout:

- retain the source database;
- retain a migration report;
- retain a target database version marker;
- allow a developer/test build to reopen the source for comparison;
- do not silently dual-write indefinitely;
- and do not roll back by deleting user data.

After a successful migration and an observation period, the old database may be retained as a user-visible backup or deleted only by an explicit cleanup policy that is separately approved.

---

## 10. Backup, Restore, and Repair

### 10.1 Export

Export must read from the canonical database.

If the canonical database is unavailable:

- fail the export;
- explain that an empty backup was not created;
- offer diagnostics;
- and do not produce a valid-looking `.focusflow` file with empty task data.

The backup format must include:

- format/schema version;
- export timestamp;
- app version;
- timezone context if relevant;
- settings;
- tasks;
- sessions/history;
- allowances;
- schedules;
- profiles/presets;
- blocked words;
- greyout windows;
- overlay/launcher configuration;
- and any other user-owned data currently supported by `backupService.ts`.

### 10.2 Import

Import must be staged:

1. Parse the file.
2. Validate format version and required fields.
3. Validate individual records.
4. Show a summary of what will be changed.
5. Create a pre-import backup.
6. Import in one database transaction where feasible.
7. Rebuild the enforcement snapshot.
8. Reconcile notifications and services.
9. Report committed, skipped, and failed records.

Do not perform per-row replacement with no rollback boundary.

### 10.3 Repair

Repair must never silently invent values.

Allowed repair actions may include:

- rebuilding indexes;
- removing only provably invalid derived records;
- reconstructing derived daily completion data from authoritative task history;
- isolating malformed optional JSON;
- rebuilding the native enforcement snapshot from canonical rows;
- or restoring from a user-approved backup.

Every destructive repair must be explicit, logged, and reversible where possible.

---

## 11. Native Service and Background Integration

### 11.1 Services that must use the repository/projection

Audit and update all relevant paths:

- `AppBlockerAccessibilityService`;
- `ForegroundTaskService`;
- `NetworkBlockerVpnService`;
- boot receiver;
- notification action receiver;
- temptation log manager;
- weekly report receiver;
- widget provider;
- background task handlers;
- and React `focusService`.

The exact list must be rechecked against the manifest and config plugin.

### 11.2 Accessibility Service

The Accessibility Service must:

- read the latest valid enforcement snapshot;
- detect missing, stale, malformed, or unsupported snapshot versions;
- log a diagnostic event when snapshot publication is invalid;
- write temptation events through the native repository or a safe append command;
- avoid directly maintaining a second full settings model;
- and reconcile its runtime state after reconnect.

The native service must not silently replace malformed configuration with an empty allow/block list unless that is the explicitly approved safety policy for the particular rule.

### 11.3 Foreground service

The foreground service must:

- restore active session state from the canonical repository/projection;
- use idempotent completion/extend/stop commands;
- reconcile after process restart;
- not create a duplicate active session;
- and update notifications without creating duplicate scheduled actions.

`FINAL_PLAN.md` enforcement fixes must remain separate and must not be lost during persistence changes.

### 11.4 VPN service

The VPN service must:

- read one canonical VPN projection;
- distinguish disabled, configured, starting, active, stopping, and error states;
- not use legacy and canonical keys as competing sources;
- persist status/revision safely;
- and reconcile after service restart.

### 11.5 Widget

The widget may read the small native snapshot for speed, but it must:

- show a known stale/unavailable state when the snapshot is invalid;
- not query or load all task rows;
- update after relevant canonical commands;
- and reconcile after boot or widget refresh.

### 11.6 Headless/background actions

Background code must not assume React state exists.

Each handler must:

- open the canonical repository;
- perform an idempotent command;
- update the projection;
- reconcile notifications/services as required;
- and record an explicit failure if persistence is unavailable.

A headless handler must not convert a database error into a successful no-op.

---

## 12. Implementation Phases

No phase may silently skip its exit criteria. A later phase must not begin as an “implementation shortcut” while an earlier phase still permits data loss.

### Phase 0 — Preparation and approval gate

Tasks:

- Confirm the current checkout and identify differences from this plan.
- Inventory all persistence call sites and duplicated keys.
- Inspect current Expo prebuild/config-plugin behavior.
- Confirm how native sources are copied into generated Android output.
- Confirm whether the Android app uses one process or multiple processes.
- Confirm available Room/Android dependency versions compatible with the current project.
- Decide the native snapshot storage format.
- Decide whether the first native repository is Android-only or must support another platform.
- Obtain approval before adding Room or other major dependencies.

Exit criteria:

- inventory is written into the implementation issue/PR notes;
- no unverified audit statement is treated as fact;
- dependency and generated-native-source implications are understood;
- and the persistence migration scope is approved.

### Phase 1 — Stop false-empty behavior in the current app

Tasks:

- Remove or disable automatic activation of `focusday_recovery.db`.
- Introduce explicit database readiness/error state.
- Centralize retry behavior.
- Remove user-data fallbacks from task/settings/session reads.
- Prevent writes before readiness.
- Prevent the watchdog from forcing readiness.
- Fix settings-screen default flicker so defaults are not shown as loaded data.
- Make backup export fail on database read failure.
- Preserve diagnostic details.

Exit criteria:

- injected temporary open failure recovers after retry;
- injected permanent failure shows an error, not an empty app;
- no task/settings mutation occurs while unavailable;
- the primary database is unchanged by failed startup;
- and the UI distinguishes “no tasks” from “tasks unavailable.”

### Phase 2 — Harden the current Expo database

Tasks:

- Define schema version and migration behavior explicitly.
- Validate migration results.
- Add health checks.
- Enable foreign keys where compatible.
- Add or verify indexes for date/status queries.
- Add the active-session uniqueness rule.
- Check affected rows.
- Keep all JavaScript mutations on the shared serialized queue until the native switch.
- Make task/session/settings operations transactional where possible.
- Fix backup/import atomicity and validation.

Exit criteria:

- concurrency tests do not produce silent lost writes;
- schema migration failures are visible;
- malformed settings are isolated/reported;
- task queries remain bounded;
- and all existing persistence helpers have explicit failure results.

### Phase 3 — Build the native Room repository

Tasks:

- Add approved Room dependencies.
- Create the native database module.
- Create entities from the verified schema/type inventory.
- Create DAOs with typed queries.
- Add database migrations and integrity checks.
- Create repositories and command results.
- Add the enforcement snapshot model and atomic publication mechanism.
- Add repository unit tests before routing production callers.

Exit criteria:

- native tests cover entities, migrations, constraints, queries, and transactions;
- today-only queries return only the intended slice;
- full history is not loaded by normal queries;
- command failures are explicit;
- and snapshot revisions are monotonic and testable.

### Phase 4 — Import and verify existing user data

Tasks:

- Implement the migration state machine.
- Quiesce old writers.
- Create the protected source backup.
- Import all confirmed user-owned data.
- Generate a migration report.
- Compare IDs, counts, totals, timestamps, and settings.
- Test interrupted imports and restart behavior.

Exit criteria:

- a representative database imports without data loss;
- interrupted imports do not activate partial data;
- malformed records are reported, not silently dropped;
- the source database remains intact;
- and only a verified target can become active.

### Phase 5 — Route the React UI through the native repository

Tasks:

- Implement the TypeScript/native adapter.
- Route task queries through native bounded queries.
- Route settings reads/writes through native commands.
- Route focus start/stop/extend/override through native commands.
- Remove production writes to Expo SQLite after the switch flag is enabled.
- Replace optimistic “success before persistence” behavior with command-result reconciliation.
- Preserve current screens and user flows.

Exit criteria:

- Schedule screen still loads today’s tasks only;
- task CRUD survives app restart;
- settings survive app restart;
- focus lifecycle survives process restart;
- errors are visible and retryable;
- and no normal UI path writes to both databases.

### Phase 6 — Route native/background paths

Tasks:

- Update Accessibility Service reads/writes.
- Update ForegroundTaskService.
- Update notification actions.
- Update boot recovery.
- Update VPN service.
- Update widget.
- Move temptation events to the repository.
- Reconcile reminder and alarm state.
- Keep UsageStats/fallback behavior aligned with `FINAL_PLAN.md`.

Exit criteria:

- background actions work with React Native stopped;
- notification actions are idempotent;
- boot restores the correct active state;
- Accessibility and VPN services use the same projection revision;
- widget state is consistent after a command;
- and native failures are not represented as successful enforcement.

### Phase 7 — Remove duplicate product stores

Tasks:

- Remove structured product data from SharedPreferences.
- Remove legacy duplicate keys after migration verification.
- Keep only the small native enforcement snapshot in the native key-value store, if still required.
- Remove AsyncStorage product-data fallback behavior.
- Retain diagnostics and deliberate backup files.
- Remove or quarantine the old Expo database according to an approved retention policy.

Exit criteria:

- one canonical durable database owner exists;
- native snapshot contents are documented and versioned;
- no user-data read path silently falls back to AsyncStorage or a recovery DB;
- and a repository search confirms no obsolete writer remains.

### Phase 8 — Reliability and release validation

Tasks:

- Run JavaScript/unit tests.
- Run Kotlin JVM/Robolectric tests.
- Run bridge contract tests.
- Run Android emulator/device tests.
- Test process death, reboot, screen off/on, notification actions, VPN restart, Accessibility restart, and widget refresh.
- Test database lock and temporary open failure injection.
- Test malformed database/settings/import data.
- Run relevant security/static analysis.
- Verify config-plugin/prebuild reproducibility.

Exit criteria:

- all required evidence layers pass;
- no critical data-loss or false-success path remains;
- release build contains the native changes after prebuild;
- and the migration can be repeated from a clean source fixture.

---

## 13. Feature Preservation Matrix

The implementation agent must verify each feature after every relevant phase.

| Feature | Canonical data | Native runtime projection | Normal read scope | Required verification |
|---|---|---|---|---|
| Today schedule | tasks/schedule rows | none or active-task subset | today plus approved overdue policy | date, timezone, ordering, empty-vs-unavailable |
| Task CRUD | task rows and related metadata | refresh if active | one row or today slice | create/update/delete/restart |
| Complete/skip | task status/history | active state if needed | affected row and stats aggregate | idempotency and stats |
| Focus start | session/task rows | active focus snapshot | active session/task | no duplicate sessions |
| Focus stop | session/task rows | cleared snapshot | active session | restart/retry behavior |
| Extend | session/task rows | new end time snapshot | active session | notification retry |
| Emergency override | override/history rows | native mode update if applicable | current session | audit record |
| Standalone block | settings/rule rows | standalone snapshot | active rule | expiry/restart |
| Always-on block | settings/rule rows | always-on snapshot | active rule | service restart |
| VPN blocking | VPN settings/rules | VPN snapshot/status | current config | start/stop/reconcile |
| Daily allowances | rule and usage rows | enforcement subset | configured apps/current date | atomic usage and midnight |
| Blocked words | blocked-word rows | native matching snapshot | configured words | malformed data handling |
| Greyout schedules | schedule rows | native schedule subset | current/selected schedule | overnight and weekday behavior |
| Launcher/system guard | settings/rule rows | native guard snapshot | current setting | explicit protection gate |
| Overlay appearance | settings/file references | native overlay subset | current appearance | missing file/error |
| Temptation log | event rows | optional current counter | bounded report query | 500-entry cap |
| Weekly report | aggregate queries/events | none | selected week | no full UI load |
| Widget | snapshot | snapshot | active/next/daily summary | stale revision handling |
| Notifications | notification metadata | OS scheduled state | current/relevant jobs | idempotent scheduling |
| Profiles/presets | profile/preset rows | selected runtime subset | selected profile/preset | migration/restore |
| Backup/export | all canonical data | none | explicit full read only | never export false empty |
| Import/restore | all canonical data | rebuilt snapshot | explicit operation | staged transaction and report |
| Onboarding | setup state | bootstrap mirror if needed | current setup only | no accidental reset |
| Diagnostics | AsyncStorage/file | none | explicit diagnostics | sanitized, user-controlled export |

---

## 14. Test Plan

### 14.1 JavaScript and adapter tests

Cover:

- startup state transitions;
- retry/backoff behavior;
- no false-ready timeout;
- no empty/default fallback on user-data failure;
- today-only query mapping;
- date/timezone boundaries;
- command-result reconciliation;
- stale cache handling;
- backup failure behavior;
- import validation;
- and native-unavailable behavior.

### 14.2 Native database tests

Cover:

- schema creation;
- every migration;
- rollback/interrupted migration;
- foreign-key behavior;
- active-session uniqueness;
- task date/status indexes;
- transactional commands;
- idempotent notification actions;
- allowance usage atomicity;
- temptation cap;
- revision generation;
- snapshot serialization/deserialization;
- malformed snapshot rejection;
- and database health-check classification.

### 14.3 Cross-boundary contract tests

Verify actual:

- shared keys and payload fields;
- stable IDs;
- timestamps and timezone values;
- package names;
- enabled states;
- durations and end times;
- native event/action names;
- malformed/missing data behavior;
- unavailable-native behavior;
- and error/result mapping.

### 14.4 Failure injection tests

Simulate:

- first open fails, second succeeds;
- all opens fail;
- database is locked temporarily;
- native handle is invalid;
- settings JSON is malformed;
- one task row is malformed;
- migration fails halfway;
- target database is incomplete;
- snapshot publication fails;
- SharedPreferences snapshot is malformed;
- native service restarts between command steps;
- process dies after Room commit but before snapshot publication;
- notification action is delivered twice;
- boot receiver runs twice;
- and an old database is opened after migration.

Expected results must be explicit. In particular:

- no false empty state;
- no silent data deletion;
- no duplicate active session;
- no duplicate completion;
- no false enforcement success;
- and a recoverable diagnostic record.

### 14.5 Android lifecycle/device tests

Run on supported API/OEM combinations as available:

- cold launch;
- warm launch;
- app process death;
- force-stop/relaunch where supported;
- device reboot;
- screen off/on;
- Accessibility Service disconnect/reconnect;
- foreground service restart;
- VPN restart;
- notification action while UI is closed;
- widget refresh;
- local date rollover;
- timezone change if supported by the product;
- low storage/error behavior;
- and battery optimization/OEM background restrictions.

### 14.6 Query-size tests

Prove that:

- normal startup does not select all tasks;
- Schedule selects today’s bounded slice;
- history uses pages or bounded ranges;
- Stats uses aggregate queries;
- native enforcement reads the snapshot/active state rather than the full task table;
- and only backup/migration performs an intentional full export.

---

## 15. Observability and Diagnostics

Every persistence failure should record sanitized diagnostics containing:

- operation category;
- database state;
- schema version;
- retry attempt;
- error classification;
- active migration state;
- snapshot revision;
- app/native version;
- and timestamp.

Do not record:

- secrets;
- authentication material;
- raw sensitive user content unless explicitly required and user-approved;
- or full task descriptions in routine logs.

Diagnostics must remain user-controlled. The existing diagnostic-email approach should remain a user-reviewed native draft with a sanitized attachment, not a server relay.

---

## 16. Agent Guardrails

Any agent implementing this plan must follow these rules:

1. Read the current source before editing; do not trust line numbers or old audit claims.
2. Do not launch a full Compose UI rewrite as part of this persistence task.
3. Do not install Room or another major dependency without the approval gate being satisfied.
4. Do not delete or rename the old database during the first implementation pass.
5. Do not keep two active writers to the old and new databases after the switch.
6. Do not use a new empty database as a live fallback.
7. Do not use AsyncStorage as a task/settings recovery store.
8. Do not load all tasks into React during normal startup.
9. Do not represent a database or native failure as a successful empty/default result.
10. Do not change UsageStats/fallback enforcement behavior outside the order and scope in `FINAL_PLAN.md`.
11. Do not change the system-control enforcement gate; native installer/system-control interception must continue to require the explicit protection toggle.
12. Do not change task-deletion focus cleanup semantics.
13. Keep durable native tests and fixtures inside the FocusFlow artifact and its established native boundary.
14. After native changes, verify that Expo prebuild/config-plugin generation includes the changes.
15. Restart the relevant workflow after code/toolchain changes and inspect logs before claiming success.

---

## 17. Definition of Done

This persistence migration is complete only when all statements below are true:

- A temporary startup database failure retries and can recover without user intervention.
- A persistent failure is visible and actionable rather than an empty account.
- `focusday_recovery.db` is not used as a silent active production database.
- The original user database is preserved during migration.
- All confirmed user-owned data migrates with stable IDs and verification evidence.
- The native Room repository is the canonical durable owner.
- React Native is a UI/client layer, not a second durable owner.
- Native services and background handlers use the same repository/projection rules.
- SharedPreferences contains only the documented runtime snapshot or explicitly approved bootstrap values.
- AsyncStorage and filesystem data are non-critical support storage only.
- Task startup reads remain bounded to today/current screen needs.
- History and statistics do not load all tasks into memory.
- Focus/session/allowance/notification commands are transactional or idempotent.
- Backup never exports a false empty database after a read failure.
- Import and repair are staged, validated, and report failures.
- Startup, migration, concurrency, process-death, reboot, service, and device tests pass.
- The implementation does not silently alter product behavior covered by `FINAL_PLAN.md`.

---

## 18. Short Execution Summary

The implementation order is:

```text
1. Stop false-empty startup behavior.
2. Harden current Expo SQLite error and migration handling.
3. Inventory and freeze the data contract.
4. Add approved native Room repository.
5. Import and verify the existing database without deleting it.
6. Route the React UI through native commands and bounded queries.
7. Route native/background services through the same repository and snapshot.
8. Remove duplicate product-data stores.
9. Run failure-injection, lifecycle, migration, and query-size validation.
10. Release only after the old blank-fallback paths are gone.
```

The central rule is:

> **Store all tasks durably, query only the relevant slice, and never confuse “database unavailable” with “the user has no data.”**

---

## 19. Log Evidence and Plan Amendments

### 19.1 Evidence reviewed

The following uploaded logs were reviewed against the current source:

- `attached_assets/Pasted-FocusFlow-Diagnostic-Log-2026-08-26T13-51-28-732Z--1787_1787765781866.txt`
- `attached_assets/Pasted-FocusFlow-Startup-Log-2026-08-25T07-00-09-493Z--1787765_1787765784411.txt`

### 19.2 What the logs prove

The logs show at least two different failure classes.

#### Failure A: WAL checkpoint encounters a database lock

At approximately `2026-08-26T06:56:48Z` and `2026-08-26T13:45:44Z`:

```text
dbCheckpointWal: dead handle
Caused by: database table is locked
```

This is important because `database table is locked` is not proof that the native handle is dead. The current `isDeadHandleError()` classification is broad enough to classify an error containing `NativeDatabase.execAsync` as a dead-handle failure.

The plan must therefore separate:

```text
SQLITE_BUSY / database table is locked
```

from:

```text
NullPointerException at the JSI/native constructor
database is not open
database has been closed
```

A lock should normally be handled by serialization, a short bounded retry, or deferring the non-essential WAL checkpoint. It should not automatically reset the database singleton.

The WAL checkpoint is maintenance, not user data. If a checkpoint is locked, the app must not destabilize the active database handle merely to complete the checkpoint.

#### Failure B: Expo/JSI native constructor failure

At approximately `2026-08-26T06:57:11Z`, `2026-08-26T13:45:44Z`, and `2026-08-26T13:50:28Z`:

```text
NativeDatabase.prepareAsync has been rejected
Caused by: java.lang.NullPointerException
at construct (native)
at apply (native)
```

The current fast path immediately opens `focusday_recovery.db` after this signature.

This evidence does not prove that `focusday.db` is corrupt. It proves that the Expo/JSI database operation could not construct or prepare the native database object at that time. The same failure also occurred while opening the recovery database at `13:50:28Z`, which means the failure can affect the native/JSI database backend or process state, not only the primary file.

The recovery database is therefore not a valid solution for this failure. It can hide the original data and can also fail in the same process.

#### Failure C: secondary fallback cascade

After the unrecoverable open result at `13:50:28Z`, the log records:

```text
dbGetSettings: returning fallback after error
dbBackfillDayCompletions failed
dbGetTodayFocusMinutes: returning fallback after error
dbGetStreak: returning fallback after error
dbPruneOldData: returning fallback after error
```

The following VPN settings warning then appears:

```text
vpn settings sync failed:
A Defense Password is required to disable network blocking
```

This is likely a secondary consequence of continuing normal initialization with fallback/default settings after the database has already failed. It must not be treated as an independent primary database diagnosis without a correlation ID.

Once canonical persistence is unavailable:

- dependent reads must stop or return an explicit unavailable result;
- maintenance must not continue as if data were valid;
- native synchronization must not apply fallback settings;
- and logs must identify dependent operations as skipped because of the root failure.

#### Normal startup and maintenance behavior

The `2026-08-25` startup log shows a successful launch:

1. notification setup begins;
2. idle foreground service starts;
3. database opening begins;
4. primary database opens in approximately `248ms`;
5. settings load;
6. multiple native settings synchronizations run;
7. tasks refresh;
8. active-session check completes;
9. startup completes.

It also shows repeated WAL checkpoints on background followed by foreground health probes. This is useful evidence that checkpoint and lifecycle operations need their own timing and concurrency instrumentation.

The normal log also shows the idle foreground service starts before database open completes. This is not yet proven to be the cause, but the implementation must instrument and test this ordering. Any native service or background operation that can touch persistence must not race initialization.

### 19.3 Required changes resulting from the logs

Add these changes to the implementation order:

1. Rename the error category currently reported as `DB_CORRUPTION_RECOVERY` when the actual observed failure is a JSI/native constructor failure.
2. Remove automatic live activation of `focusday_recovery.db`.
3. Split error classification into lock/busy, dead handle, JSI constructor failure, schema/migration failure, integrity failure, and unknown native failure.
4. Do not reset the database singleton for a WAL checkpoint lock unless a separate health probe proves the handle is dead.
5. Serialize or defer WAL checkpoint maintenance relative to writes.
6. Add a root-operation ID so settings, statistics, pruning, VPN synchronization, widget updates, and other dependent operations can be grouped under one startup attempt.
7. Stop the initialization cascade after canonical persistence becomes unavailable.
8. Do not synchronize native settings from fallback/default values after a database failure.
9. Add a native/JSI backend health event that records whether both the primary and recovery open failed with the same constructor signature.
10. Test opening, checkpointing, and background/foreground transitions on the affected Android API/device family.

---

## 20. Cross-Storage Observability Plan

Better logging is required before and during the migration. Without it, the next incident will show that an operation failed but not which storage owner, queue, lifecycle event, or dependent action caused the visible symptom.

### 20.1 Logging architecture

Create one logical `PersistenceTelemetry` event format used by JavaScript and Kotlin. The implementation may use separate language types, but the serialized fields and meanings must match.

The event must be emitted at the storage boundary, not only at the screen/orchestration layer.

Required event fields:

```text
eventId                 unique event identifier
parentOperationId       startup/command operation that caused this event
bootSessionId            cold-process or warm-resume session identifier
timestampUtc             ISO-8601 UTC timestamp
monotonicElapsedMs       elapsed time within the process when available
component                database / AppContext / SharedPrefs / service / etc.
storage                  expo_sqlite / sqlite_native / shared_prefs / async_storage / file
operation                open / read / write / transaction / checkpoint / migrate / remove / sync
phase                    queued / started / acquired / committed / rolled_back / skipped / failed
result                   success / retry / unavailable / conflict / malformed / failed
durationMs               total operation duration
queueWaitMs              time waiting behind a queue, if applicable
queueDepth               queue depth at operation start, if applicable
databaseName             primary or target name; never use a fallback name as if canonical
databaseHandleGeneration logical handle generation after reset/reopen
schemaVersion            known schema version or unknown
revision                 canonical/native snapshot revision when applicable
errorClass               normalized failure category
errorCode                stable local code when available
nativeApi                Android API level and relevant Expo/native API
device                   sanitized manufacturer/model/build family when allowed
payloadBytes             serialized payload size, not payload contents
rowCount                 affected/read count where safe
keyCategory              allowlisted SharedPrefs/AsyncStorage category
redactionFlags           indicate omitted task text, package lists, or sensitive values
```

Do not log full SQL values, settings JSON, task descriptions, PINs, hashes, full package lists, or backup contents. Use counts, key categories, stable internal IDs only when safe, and hashes where comparison is necessary.

### 20.2 Operation correlation

Every startup, user command, background action, and migration must receive a parent operation ID.

Examples:

```text
startup-20260826-...
task-command-...
notification-action-...
background-overrun-...
migration-...
```

The exact ID format is not important; uniqueness and propagation are.

The following sequence must be traceable as one operation:

```text
AppContext startup
 -> database open
 -> schema health check
 -> settings read
 -> task read
 -> native snapshot publication
 -> widget refresh
 -> reminder reconciliation
```

If the database fails, later events must say:

```text
skipped: parent persistence operation unavailable
```

They must not produce misleading independent fallback-success events.

### 20.3 Error classification

Use normalized categories rather than matching only one free-form message:

```text
SQLITE_BUSY
SQLITE_LOCKED
SQLITE_CORRUPT
SQLITE_NOTADB
SQLITE_SCHEMA
NATIVE_HANDLE_DEAD
JSI_CONSTRUCTOR_FAILURE
DATABASE_NOT_OPEN
MIGRATION_FAILED
VALIDATION_FAILED
SHARED_PREFS_UNAVAILABLE
SHARED_PREFS_MALFORMED
ASYNC_STORAGE_UNAVAILABLE
ASYNC_STORAGE_MALFORMED
FILE_STORAGE_UNAVAILABLE
NATIVE_MODULE_MISSING
SNAPSHOT_STALE
SNAPSHOT_PUBLICATION_FAILED
UNKNOWN_STORAGE_ERROR
```

Classification must use the most specific available signal:

1. native error code/type;
2. known SQLite error text;
3. known Expo/JSI signature;
4. operation context;
5. unknown.

Do not classify an error as a dead handle solely because its message contains `NativeDatabase`.

### 20.4 Severity policy

Use severity based on user impact:

- `DEBUG`: successful low-value reads, queue details, normal cache hits.
- `INFO`: startup milestones, successful migration steps, successful snapshot publication.
- `WARN`: bounded retry, deferred WAL checkpoint, stale snapshot, malformed optional data, skipped dependent operation.
- `ERROR`: canonical database unavailable, failed transaction, failed migration, failed import, failed snapshot publication, or data-preserving repair failure.
- `FATAL`/equivalent: only if the app cannot safely continue at all; do not use for an ordinary empty state.

Normal successful task reads must not flood persistent logs. Slow operations, retries, failures, and state transitions are more valuable than every successful query.

### 20.5 Logging the logger

The diagnostic logger itself currently catches and ignores AsyncStorage and filesystem write errors. That protects the app from logger failures, but it also hides whether diagnostics were actually persisted.

Add an internal non-recursive sink status:

- AsyncStorage log write succeeded/failed;
- file log write succeeded/failed;
- memory buffer retained the event;
- rotation occurred;
- clear operation succeeded/failed;
- and last successful persistence time.

Logger-sink failure must never call the normal logger recursively. It should update an in-memory sink-health counter and emit a single throttled warning to console/logcat when possible.

At least one diagnostic sink must remain independent of the failing storage being investigated. For example, a database failure must still be reportable to memory, logcat, and/or the file sink.

---

## 21. Storage-Specific Instrumentation Requirements

### 21.1 `src/data/database.ts` and Expo SQLite

Instrument these boundaries:

- `openDatabaseAsync`;
- schema initialization;
- every centralized retry;
- every database reset;
- every transaction;
- every queued write;
- every write commit/rollback;
- every WAL checkpoint;
- database health probe;
- migration;
- and recovery/repair actions.

For each event record:

- primary/target database name;
- operation name;
- handle generation;
- queue wait and depth;
- duration;
- whether the operation was read, write, transaction, or maintenance;
- normalized error class;
- whether the retry used the same handle, a fresh handle, or a different file;
- and whether the operation changed user data.

Specific rules:

1. `SQLITE_BUSY`/`SQLITE_LOCKED` during `dbCheckpointWal` must be logged as a lock and normally deferred/retried, not as a dead handle.
2. A JSI constructor NPE must log the exact native signature category and preserve the primary database.
3. Primary and recovery open attempts must be separate events with distinct names.
4. The recovery name must never be logged as an acceptable canonical data source.
5. `runWithDbOr` must not be used for canonical task/settings/session reads after Phase 1.
6. Maintenance such as backfill, pruning, and checkpointing must be skipped when the database is unavailable, with a parent-operation reason.
7. Health probes must distinguish “handle not open,” “probe failed,” and “probe succeeded.”
8. Slow reads/writes must report statement/operation name and row count, not raw bound values.

Because Expo SQLite does not necessarily expose a complete low-level SQLite trace in the current integration, instrumentation must be placed around the project’s wrapper calls. Do not claim that a wrapper log is a native SQLite trace.

### 21.2 Native SQLite/Room layer

When Room is introduced, instrument:

- database creation/open;
- Room migration start/end/failure;
- DAO query timing above a slow-query threshold;
- transaction start/commit/rollback;
- connection/initialization failures;
- integrity checks;
- import/export batches;
- and snapshot rebuilds.

The Room layer must retain a small diagnostic metadata record such as:

```text
last_open_success_at
last_health_check_at
last_migration_version
last_integrity_result
last_snapshot_revision
```

This metadata is diagnostic only. It must not replace the actual database status machine or become user data.

A database diagnostic table may be added for recent storage events when the database is healthy, but it cannot be the only log sink because it is unavailable precisely when database failures occur.

### 21.3 SharedPreferences JavaScript wrapper

Update `src/native-modules/SharedPrefsModule.ts` instrumentation so every native call can distinguish:

```text
method missing
native call started
native call succeeded
native call rejected
result malformed
default returned because bridge unavailable
```

Do not report `undefined`, `null`, or `0` as a normal successful read when the native method was missing or threw.

For writes, log:

- method name;
- logical key category, not arbitrary raw key where possible;
- payload byte size;
- package/word count if applicable;
- duration;
- result;
- and snapshot revision when applicable.

For reads, log:

- key category;
- hit/miss;
- parse/validation result;
- stale revision;
- and whether the value was used for enforcement or UI only.

The wrapper must not log PIN input, PIN hashes, complete task titles, or full package/blocked-word payloads.

### 21.4 Native Kotlin SharedPreferences

Instrument the Kotlin module and native services around:

- preference editor creation;
- grouped editor commit/apply;
- JSON parse/serialize;
- allowance read-modify-write;
- snapshot publication;
- service restore;
- widget update;
- VPN state update;
- and boot reconciliation.

One grouped logical update must produce one logical telemetry event even if multiple preference fields are written internally.

Every grouped update must include:

- logical snapshot/category name;
- previous and next revision;
- field count;
- payload byte size;
- commit/apply completion;
- and any parse/validation failure.

Do not log each low-level preference key as unrelated success when the operation is one logical snapshot update.

Malformed JSON must produce a `SHARED_PREFS_MALFORMED` event with the key category and size, not a silent conversion to an empty list/object.

### 21.5 AsyncStorage

Instrument:

- `getItem`;
- `setItem`;
- `removeItem`;
- `multiGet`;
- `multiSet`;
- and queue/serialization waits.

Each event must record:

- allowlisted logical key category;
- operation;
- payload byte size;
- duration;
- queue wait;
- parse/validation result;
- and failure class.

Do not log arbitrary key values. The logger must know which keys are:

```text
diagnostic log
setup backup
privacy marker
onboarding marker
UI hint
```

Setup backups must log source disagreement explicitly:

```text
SharedPreferences says true
AsyncStorage says false
combined record malformed
```

They must not silently resolve disagreement without recording which source won and why.

AsyncStorage failure must not reset onboarding or privacy state, and it must not be used to recover tasks/settings.

### 21.6 Filesystem diagnostics

Instrument:

- log file read;
- log file rewrite;
- rotation;
- delete/clear;
- export/share preparation;
- migration artifact creation;
- and backup file write.

Record:

- logical file category;
- byte size;
- duration;
- URI/path type without exposing private absolute paths unnecessarily;
- and success/failure.

Use atomic temp-write/rename behavior where supported for diagnostics and migration artifacts. Do not overwrite the only diagnostic copy before the replacement is complete.

---

## 22. Logging Retention and Privacy

The logging system must support useful future diagnosis without turning local logs into a copy of the user's private schedule.

Required retention:

- bounded in-memory recent events;
- bounded persistent diagnostic events;
- rotation by entry count and/or byte size;
- explicit clear action;
- diagnostic export controlled by the user;
- and a visible indication of whether the current log is complete or only a partial session.

Required redaction:

- no PINs or PIN hashes;
- no secrets or credentials;
- no full settings JSON;
- no task descriptions or notes;
- no full backup content;
- package names only when required for diagnosing enforcement, preferably as counts or stable redacted identifiers;
- no raw file contents;
- and no arbitrary AsyncStorage/SharedPreferences values.

Each exported log must state:

```text
log retention window
whether AsyncStorage persistence succeeded
whether file persistence succeeded
whether events were dropped/rotated
whether the database was unavailable
```

This prevents a future engineer from interpreting a partial diagnostic file as a complete history.

---

## 23. Observability Acceptance Tests

Add tests for the exact log-derived failures:

1. A WAL checkpoint receives `database table is locked`.
   - event is `SQLITE_LOCKED` or `SQLITE_BUSY`;
   - handle is not reset solely because of this;
   - checkpoint is deferred/retried;
   - user data remains available.

2. Primary `prepareAsync` receives the JSI constructor NPE.
   - event is `JSI_CONSTRUCTOR_FAILURE`;
   - primary file is preserved;
   - no live recovery database is selected;
   - startup enters retry/error state.

3. Primary and recovery attempts both receive the same JSI NPE.
   - events share the same parent operation ID;
   - the result is classified as backend/process unavailability;
   - the app does not continue with default settings;
   - dependent statistics/pruning/VPN sync are skipped with causal events.

4. Settings read fails after startup open failure.
   - no default settings are persisted;
   - no native settings sync runs from fallback values;
   - UI remains unavailable/read-only.

5. SharedPreferences method is missing.
   - log distinguishes method missing from native call failure;
   - no silent “success” is recorded.

6. AsyncStorage write fails while file logging succeeds.
   - event remains available through the file sink;
   - sink-health status records the AsyncStorage failure;
   - no recursive logger failure occurs.

7. File logging fails while AsyncStorage succeeds.
   - event remains available through AsyncStorage;
   - sink-health status records file failure.

8. Diagnostic logging itself is interrupted.
   - memory buffer keeps recent events;
   - export clearly reports that persistence was partial.

9. Normal Schedule startup with many historical tasks.
   - telemetry shows a bounded today query;
   - no all-task query occurs;
   - full read is visible only for explicit export/migration.

---

## 24. Updated Execution Order

The log evidence changes the first implementation order to:

```text
1. Add cross-storage correlation IDs and error classification.
2. Stop treating NativeDatabase lock errors as dead handles.
3. Make WAL checkpoint maintenance non-destructive and serialized/deferred.
4. Remove automatic live recovery-database activation.
5. Stop fallback/default initialization cascades after root DB failure.
6. Add bounded startup retry and explicit unavailable/read-only states.
7. Add failure-injection tests for lock and JSI constructor NPE.
8. Harden the current Expo database layer.
9. Introduce and verify the native Room repository.
10. Route foreground/background writers through one repository.
11. Keep SharedPreferences only as a revisioned native enforcement snapshot.
12. Remove duplicate product-data stores and obsolete fallback paths.
```

The critical diagnostic lesson is:

> **A locked checkpoint and a JSI constructor NPE are different failures. The first should not destroy a healthy handle, and the second must not be disguised as an empty database.**

---

## 25. Refactor Risk Review

This work is a **major architectural refactor**, but it must not be executed as a big-bang rewrite.

The formal review is stored at:

`artifacts/focusflow/PERSISTENCE_RELIABILITY_PLAN_REVIEW.md`

The review adds mandatory controls for risks that could leave part of the old system behind:

- a migration freeze and complete persistence-key inventory;
- one backend decision through a single adapter;
- no indefinite dual-write mode;
- an explicit rollback/data-compatibility decision;
- a durable outbox for effects that cannot share a Room transaction, including alarms, notifications, VPN, widgets, and native services;
- boot-before-unlock handling;
- Android process-model verification;
- Expo prebuild/config-plugin/installer generation checks;
- backup coverage verification;
- security-sensitive value handling;
- timezone and clock migration tests;
- a repository-wide final writer audit;
- and a “nothing remains behind” completion checklist.

The revised safe order is:

```text
observability-only release
→ startup-safety release
→ repository contract over legacy storage
→ Room behind the repository
→ fixture/import verification
→ controlled read comparison
→ verified user-data cutover
→ native/background cutover
→ cleanup after an observation period
```

The first implementation must stop after observability and startup safety until the data inventory, generated Android build path, backup coverage, process model, and rollback policy are verified. No agent may delete Expo SQLite, SharedPreferences, the old React Native bridge, or the old database during the first pass.