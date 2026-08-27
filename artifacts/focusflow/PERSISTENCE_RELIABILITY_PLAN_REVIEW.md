# Review of the FocusFlow Persistence Reliability Plan

## Review status

- **Review date:** 2026-08-26
- **Reviewed plan:** `artifacts/focusflow/PERSISTENCE_RELIABILITY_PLAN.md`
- **Review purpose:** identify anything that could remain half-migrated or break existing features during the persistence refactor
- **Conclusion:** the work is a major architectural refactor and must be executed as a gated migration, not as a simultaneous rewrite
- **Implementation status:** no application code changed as part of this review

---

## 1. Direct answer: is this a major refactor?

Yes.

It is a major refactor because it changes the ownership and execution path of:

- tasks;
- settings;
- focus sessions;
- allowance rules and usage;
- reminders and notifications;
- background/headless actions;
- Accessibility enforcement;
- VPN state;
- widget state;
- boot recovery;
- temptation history;
- backup/import;
- and the JavaScript/native boundary.

It is **not** a full product rewrite if the first version keeps the current Expo/React Native UI. The safer description is:

> **A major data-layer and native-integration refactor with a temporary compatibility layer, not a full UI rewrite.**

The refactor becomes unsafe if an agent tries to do all of these at once:

- add Room;
- rewrite all database entities;
- rewrite every React screen;
- remove Expo SQLite;
- delete SharedPreferences code;
- change the native services;
- change the notification system;
- and change the generated Android project.

The revised plan must prevent that by making every phase independently testable and by requiring explicit gates before the next phase starts.

---

## 2. Current project boundaries that make this risky

The review checked the current project configuration rather than relying only on older planning documents.

### 2.1 The app is still an Expo/React Native application

`artifacts/focusflow/package.json` still uses:

- Expo SDK 54;
- React Native 0.81;
- `expo-sqlite`;
- AsyncStorage;
- Expo background tasks;
- Expo notifications;
- and the old-architecture React Native native-module bridge.

`app.json` currently has:

```text
newArchEnabled: false
android.package: com.tbtechs.focusflow
```

The new repository must not assume that the application has already become a standalone Kotlin app.

### 2.2 Native code is generated/copied, not edited in only one place

The config plugin `plugins/withFocusDayAndroid.js` copies Kotlin sources and patches the generated Android project during Expo prebuild.

`android-native/install.sh` also copies native Kotlin sources, tests, resources, manifest entries, and Gradle dependencies after prebuild.

Therefore, a Room change can be accidentally lost if it is added only to generated `android/` output.

The durable source of truth must be:

```text
artifacts/focusflow/android-native/
artifacts/focusflow/plugins/withFocusDayAndroid.js
artifacts/focusflow/android-native/install.sh
```

Generated Android output must be treated as a build artifact and verified after regeneration.

### 2.3 The old bridge cannot be deleted early

The current JavaScript modules, including `SharedPrefsModule.ts` and other native-module wrappers, are still used by the React UI and orchestration code.

`FocusDayPackage` and its native modules must remain until:

1. all JavaScript callers have moved to the compatibility adapter;
2. all background paths have moved to the repository;
3. all native services have moved to the new repository/projection;
4. generated builds no longer require the old modules;
5. and a repository search proves that no production caller remains.

Deleting old bridge modules earlier would create a partially migrated app with compile failures or silent no-op paths.

---

## 3. Findings from the review

### Finding 1 — The plan needs an explicit migration freeze

Before changing persistence behavior, capture a baseline of current feature behavior and data shape.

Add a migration freeze step that records:

- current database schema and `user_version`;
- all current tables, columns, indexes, and JSON fields;
- all `db*` functions and direct SQLite call sites;
- all SharedPreferences keys and writers;
- all AsyncStorage keys and writers;
- every native receiver/service/widget;
- every notification/alarm identifier;
- every backup envelope field;
- every active feature gate;
- and current expected behavior for today, overdue, recurring, timezone, and active-session handling.

No entity or migration code should be invented before this inventory exists.

### Finding 2 — The plan needs a no-half-cutover rule

The most dangerous state is not “old” or “new.” It is:

```text
some foreground calls use Room
some foreground calls use Expo SQLite
some background calls use SharedPreferences
some notifications use old task IDs
```

Add this rule:

> At any point in a release build, one adapter decides the canonical backend for each product domain. Individual screens and services may not choose a backend independently.

During migration, the adapter may have these controlled modes:

```text
LEGACY_ONLY
MIGRATION_READ
NATIVE_ONLY
```

`MIGRATION_READ` is for controlled comparison/import validation. It must not become indefinite production dual-write behavior.

There must be no mode where both databases receive normal production writes.

### Finding 3 — Rollback is not automatically safe after native writes

Once the new Room database receives writes, an older app version may not understand the new database. Simply rolling back the APK could therefore make the old app appear empty or outdated.

The plan must define one of these strategies before release:

1. **Forward-only data cutover:** old app versions are not supported after native cutover, and the app update process communicates this limitation.
2. **Backward-compatible export bridge:** every native write is also represented in a legacy-compatible source until the rollback window closes. This must not be implemented as unsafely dual-writing two independent databases.
3. **Versioned rollback migration:** a tested conversion exists from the native database back to the legacy format.

The preferred strategy is to avoid a release that requires unsafe dual-writing. Retain the original source as a protected backup and support forward recovery/import rather than pretending an old binary can automatically read new data.

The plan must include an explicit release/rollback decision. “Rollback” must not mean deleting the new database.

### Finding 4 — Room commit and Android side effects are not one transaction

A Room transaction cannot atomically commit with:

- SharedPreferences;
- AlarmManager;
- WorkManager;
- notification manager;
- VPN service state;
- foreground service state;
- widget redraw;
- or Accessibility runtime state.

The current plan mentions reconciliation, but it needs a durable mechanism for unfinished side effects.

Add a native outbox/reconciliation model equivalent to:

```text
pending_effects
  effect_id
  aggregate_type
  aggregate_id
  canonical_revision
  effect_type
  payload/reference
  status
  attempts
  last_error
  next_attempt_at
  created_at
  completed_at
```

The transaction should:

1. commit canonical data;
2. record the required projection/OS effect;
3. publish the native snapshot where required;
4. process the effect idempotently;
5. mark it complete only after success.

On startup, boot, service reconnect, or foreground resume, pending effects must be reconciled.

This prevents a crash after a database commit but before a widget, notification, VPN, or native service update from leaving the app permanently inconsistent.

### Finding 5 — Boot-before-unlock behavior must be explicit

The config plugin already documents that `BOOT_COMPLETED` may occur before user data is unlocked and that `USER_UNLOCKED` is needed for protected data.

The native database plan must define:

- whether Room is credential-protected or device-protected;
- which boot events are safe to handle before unlock;
- what BootReceiver does before unlock;
- how it avoids opening the database too early;
- and how it reconciles after `USER_UNLOCKED`.

Do not make the new Room database available to pre-unlock services by assumption.

Safe pre-unlock behavior may be limited to:

- recording a deferred reconciliation marker;
- stopping/avoiding unsafe service startup;
- and waiting for `USER_UNLOCKED`.

The existing native enforcement snapshot may still be readable only if the product explicitly accepts that behavior on the device. This must be tested rather than assumed.

### Finding 6 — Process model must be verified

Before choosing Room access patterns, inspect the generated manifest and all service declarations for explicit process assignments.

If all components run in one process:

- a process-local repository singleton may be used carefully;
- database access still requires coroutine/transaction serialization.

If any component runs in another process:

- process-local Room singletons are insufficient;
- cross-process invalidation and writes need an IPC or other explicit boundary;
- and the plan must not claim that one in-memory singleton serializes all writers.

The implementation agent must record the result of this check before choosing the repository initialization design.

### Finding 7 — Generated native code needs a build gate

Every native persistence change must be present in both the durable source and the generated build path.

The plan must require:

1. edit durable Kotlin/config-plugin/install sources;
2. run Expo prebuild in a clean/generated test project;
3. run the native installer if that remains part of the build;
4. verify Room sources, resources, manifest entries, and dependencies exist;
5. compile the generated Android project;
6. repeat after a clean regeneration.

A green test against manually edited `android/` output is not sufficient.

### Finding 8 — Backup coverage is currently narrower than the migration target

The current `backupService.ts` envelope visibly includes settings, tasks, preset sections, and summary counts. It does not automatically prove that all sessions, overrides, daily completion history, reports, temptation events, and every user-owned field are exported.

The migration plan must not claim that the current backup is a complete source until it is verified.

Add a backup inventory and round-trip requirement:

- list every user-owned field in the current schema/types;
- identify whether it is currently exported;
- add versioned fields for missing durable history;
- preserve unknown forward-compatible fields where possible;
- test export/import/export equivalence;
- and show warnings for fields intentionally excluded as device-local runtime state.

### Finding 9 — Feature gates need to be included in the ownership inventory

The data migration must explicitly preserve behavior for:

- system-control protection;
- installer/uninstall interception;
- launcher settings and launcher package lists;
- overlay appearance and wallpaper references;
- VPN package selection and status;
- focus allowed packages;
- standalone and always-on blocking;
- daily allowance count/time/interval modes;
- blocked words;
- greyout schedules including overnight windows;
- session PIN protection;
- device admin and foreground service behavior;
- temptation reports;
- widgets;
- task-end alarms;
- notification actions;
- profiles and presets;
- and onboarding/privacy state.

The implementation agent must map every current SharedPreferences key to one of:

```text
canonical database field/table
native enforcement snapshot field
bootstrap-only mirror
diagnostic-only value
obsolete key with migration/cleanup rule
```

No key may remain undocumented.

### Finding 10 — Security-sensitive values need a separate decision

The persistence migration must not casually move PIN material, protection hashes, or sensitive configuration into a less protected store.

Before implementation:

- inventory which values are hashes, secrets, or protection state;
- distinguish a hash from the original secret;
- define whether Android Keystore is required;
- preserve existing protection behavior;
- and test that a migration cannot disable protection by writing a default/malformed value.

This is a security/data-ownership decision, not merely a schema conversion.

### Finding 11 — Time and date semantics need migration tests

FocusFlow behavior depends on:

- local day boundaries;
- task start/end timestamps;
- recurring schedules;
- overnight greyout windows;
- allowance reset dates;
- streak calculations;
- UsageStats windows;
- and device clock changes.

The new database must preserve the existing representation and semantics until a deliberate change is approved.

Tests must cover:

- UTC versus local timezone conversion;
- daylight-saving transitions where relevant;
- midnight rollover;
- overnight schedules;
- allowance reset at local midnight;
- device reboot across midnight;
- and clock changes/tamper-defense behavior.

### Finding 12 — Logging must not become a new failure source

The new telemetry design is useful, but it must not:

- block the user command on persistent log writes;
- write recursively when a log sink fails;
- hold the SQLite write queue;
- include raw user content;
- or create an unbounded log database.

Storage telemetry should be:

- asynchronous where safe;
- bounded;
- sampled for normal successes;
- synchronous only for critical state transitions where needed;
- and independent of the database being diagnosed.

### Finding 13 — The final cleanup needs a static writer audit

Before removing old code, run a repository-wide audit for:

```text
expo-sqlite
openDatabaseAsync
runWithDbOr
SQLite.
SharedPrefs.
NativeModules.SharedPrefs
AsyncStorage.
focusday_recovery.db
focusday.db
notification action constants
alarm request codes
direct SharedPreferences access
```

The output must classify each remaining usage as:

- canonical adapter;
- native snapshot;
- diagnostics;
- migration-only;
- test fixture;
- or obsolete.

Any unexplained production usage blocks cutover.

---

## 4. Revised safest implementation sequence

The original phases are directionally correct, but the following order is safer for the current project.

### Gate 0 — Approval and baseline

Do not add Room or change ownership yet.

Complete:

- source/schema/key inventory;
- process-model check;
- generated-code/build-path check;
- backup coverage inventory;
- feature behavior baseline;
- old-to-new compatibility decision;
- and rollback policy.

### Gate 1 — Observability-only release

Add structured, correlated telemetry without changing storage ownership.

Measure:

- lock versus dead-handle errors;
- JSI constructor failures;
- primary/recovery open attempts;
- queue depth and checkpoint overlap;
- startup ordering;
- SharedPreferences bridge failures;
- AsyncStorage/file sink failures;
- and dependent-operation cascades.

This release should not migrate data or change user-visible feature behavior except for exposing better diagnostics.

### Gate 2 — Startup safety release

Change only failure behavior:

- no live recovery-database fallback;
- bounded retries;
- explicit unavailable/read-only state;
- no fallback/default writes;
- no dependent initialization cascade;
- non-destructive checkpoint behavior;
- and user-controlled diagnostics.

This is the first release that directly addresses the intermittent blank/error startup problem.

### Gate 3 — Repository contract over the legacy backend

Introduce the repository/command interface while the implementation still delegates to the existing Expo database.

Purpose:

- stabilize the API boundary;
- move callers one by one;
- test command result/error semantics;
- preserve current UI;
- and prove that all foreground/background paths can use one boundary.

This phase reduces the number of callers before changing the database engine.

### Gate 4 — Native repository and migration fixture

Add Room behind the repository boundary.

Before real-user migration:

- create deterministic old-database fixtures;
- import them;
- verify counts/IDs/field values;
- test malformed data;
- test interrupted migration;
- test upgrade from every supported old schema;
- and test generated Android builds.

### Gate 5 — Controlled read comparison

For migration validation only:

- read bounded today/history/statistics queries from both representations;
- compare normalized results;
- compare active-session and enforcement projections;
- do not dual-write normal user actions;
- and do not let comparison data drive production behavior.

Any mismatch blocks cutover until classified.

### Gate 6 — Verified user-data cutover

Only after Gate 5:

- quiesce old writers;
- back up the source;
- import and verify;
- switch the repository backend;
- publish the snapshot;
- reconcile outbox effects;
- and keep the old source protected.

### Gate 7 — Native/background cutover

Move services, receivers, widget, VPN, alarms, and temptation logging one path at a time.

After each path:

- search for old writers;
- run its lifecycle tests;
- test process death/restart;
- test duplicate delivery;
- and verify the snapshot revision.

### Gate 8 — Cleanup after an observation period

Only after successful upgrade, restart, reboot, backup, import, and background testing:

- remove obsolete writers;
- remove legacy product-data keys;
- remove old bridge modules;
- remove old database fallback code;
- and decide whether to retain the old source as a user-visible backup.

---

## 5. “Nothing remains behind” checklist

The refactor must not be marked complete until all items are checked.

### JavaScript

- [ ] No normal task/settings/session writer bypasses the repository adapter.
- [ ] No normal read path uses empty/default fallback after canonical failure.
- [ ] No background handler assumes React state exists.
- [ ] No normal startup reads all tasks.
- [ ] No backup path catches a database failure and exports an empty valid backup.
- [ ] No React optimistic update is treated as durable success before command confirmation.

### Expo SQLite

- [ ] Legacy database access is adapter-owned or migration-only.
- [ ] `focusday_recovery.db` is not a live user-data backend.
- [ ] WAL checkpoint errors are classified separately from dead handles.
- [ ] All mutations have explicit result/error behavior.
- [ ] Direct legacy call sites are accounted for.

### SharedPreferences

- [ ] Every remaining key has an ownership classification.
- [ ] No full settings JSON remains as an undocumented source of truth.
- [ ] Native runtime snapshot has a version and revision.
- [ ] Native services reject stale/malformed snapshots explicitly.
- [ ] Related fields are published as one logical snapshot.
- [ ] Legacy keys have migration and cleanup rules.

### AsyncStorage/files

- [ ] AsyncStorage is not a task/settings/session fallback.
- [ ] Setup disagreement is logged and resolved by documented authority.
- [ ] Logger sink failures are observable without recursion.
- [ ] Diagnostic and backup files are versioned and validated.

### Native/generated Android

- [ ] Room sources are stored under the durable native source tree.
- [ ] Config plugin and installer include required new sources/dependencies.
- [ ] Clean Expo prebuild reproduces the native code.
- [ ] Generated Android compilation passes.
- [ ] Boot-before-unlock behavior is tested.
- [ ] Every receiver/service/widget uses the intended repository/projection.
- [ ] Old bridge modules are not deleted while callers remain.

### Data lifecycle

- [ ] Upgrade from every supported old schema is tested.
- [ ] App restart preserves all data.
- [ ] Process death preserves all data and reconciles effects.
- [ ] Reboot preserves all data and reconciles effects.
- [ ] Backup round-trip preserves all user-owned data.
- [ ] Import is staged and atomic.
- [ ] Failed migration leaves the source intact.
- [ ] Rollback behavior is documented and tested.

---

## 6. Final review decision

The architecture is acceptable only with the additional gates and guardrails in this review.

The recommended implementation path is:

```text
observability
→ startup safety
→ repository boundary over legacy storage
→ native Room behind the boundary
→ verified migration
→ native/background cutover
→ cleanup
```

Do not start by deleting Expo SQLite, SharedPreferences, or the old native bridge.

The first implementation should be limited to the low-risk observability and startup-safety phases. Those phases provide evidence about the current intermittent failure before a major data-owner change is attempted.

The refactor is considered safe only when the project can answer, for every feature and every persistence key:

```text
Who owns this data?
Who can write it?
What happens if the write fails?
How is it restored after process death?
How is it migrated?
How is it queried without loading unrelated data?
How is it verified after an upgrade?
```