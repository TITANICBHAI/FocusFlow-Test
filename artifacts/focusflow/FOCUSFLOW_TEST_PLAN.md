# FocusFlow Feature Test Plan

## Implementation Progress

Legend: `[x]` implemented and present in this checkout · `[ ]` not yet implemented
or not yet evidenced · `[~]` partially covered or environment-dependent.

### Test infrastructure and current evidence

- [x] Vitest runner and FocusFlow test command
- [x] JavaScript unit tests for scheduler, tasks, PIN crypto, PIN reuse, backup, and setup persistence
- [x] JavaScript service orchestration tests for focus start/stop and headless background tasks
- [x] React↔Kotlin SharedPreferences serialization contract tests
- [x] React↔native event contract tests
- [~] Full TypeScript typecheck (known pre-existing application errors are documented in `TEST_SETUP.md`)
- [~] Kotlin JVM/policy test source is present and wired for generated projects; local command is unavailable without Android/Gradle tooling
- [ ] Android/Robolectric test source and command
- [ ] Instrumented/emulator/device test source and command
- [ ] Grouped CI validation workflow for FocusFlow test layers
- [x] Reproducible test inventory with command, layer, proof, result, and limitations

### Delivery milestones

- [x] Milestone 1 — fast, pure coverage (scheduler, task lifecycle, PIN, backup, persistence, diagnostics, and notification coverage present)
- [~] Milestone 2 — service orchestration (focus start/stop, notifications, backup, and diagnostics covered; settings sync remains)
- [ ] Milestone 3 — persistence
- [ ] Milestone 4 — Kotlin policy
- [ ] Milestone 5 — Android lifecycle and device behavior
- [~] Milestone 6 — cross-layer proof and reliability (boundary suites exist; reconciliation, restart, stress, and device evidence remain)

### Review-derived gap tracking

These items were added after reviewing the plan against the current implementation.
`[x]` means covered by durable tests, `[~]` means partly covered or only covered
on one side of a boundary, and `[ ]` means still pending.

- [ ] Fallback poller remains scheduled for always-on-only and allowance-only modes instead of exiting early
- [ ] UsageStats fallback uses the latest `queryEvents` package rather than a misleading `queryUsageStats` result
- [ ] Fallback foreground detection and allowance expiry are covered with distinguishing inputs
- [ ] Session duration remains correct across duplicate same-package resume events, including launch count
- [ ] Screen-off pause and ForegroundTaskService sync cannot double-charge or incorrectly exhaust allowance
- [ ] Repeated overrun delivery cannot double-extend a task during the notification replacement race
- [ ] Overnight greyout windows carry the configured weekday into the next morning
- [x] Medium-priority conflict behavior is documented as either intended or a known failing contract
- [~] SharedPreferences contracts cover JS serialization and native event shapes; Kotlin producer/consumer fixtures remain
- [ ] Raise-only `daily_allowance_used` behavior is tested against a lower UsageStats value
- [ ] Backup replacement is guarded while a focus session is active
- [~] Bulk scheduling is capped at the notification capacity; 48-hour horizon and native alarm capacity remain
- [x] SHA-256 fallback is verified against known-answer vectors without Web Crypto
- [ ] Always-on plus allowance precedence is tested
- [ ] Manually owned always-on packages are not removed by automatic standalone cleanup
- [ ] Standalone VPN handoff has no protection gap

## Purpose

This document is the implementation guide for adding tests to FocusFlow.
It is intentionally self-contained: the engineer implementing the tests must
not need access to an external reference-test ZIP.

The plan is based on the current FocusFlow architecture:

- Expo 54 / React Native 0.81 application
- Expo Router screens under `artifacts/focusflow/app`
- TypeScript services, utilities, data models, and native-module bridges under
  `artifacts/focusflow/src`
- Custom Android Kotlin enforcement code under
  `artifacts/focusflow/android-native`
- SQLite persistence through `expo-sqlite`
- SharedPreferences-backed state shared between JavaScript and Kotlin
- Android AccessibilityService, foreground service, UsageStats, VPN,
  notifications, alarms, receivers, overlays, and launcher behavior

The test suite must test FocusFlow's behavior and contracts. It must not copy
another app's domain model, package structure, or assumptions.

All FocusFlow test code and test configuration belongs inside the separate
FocusFlow artifact directory:

- `artifacts/focusflow/` — JavaScript/React tests, fixtures, mocks, test
  configuration, and FocusFlow-specific test scripts
- `artifacts/focusflow/android-native/` — Kotlin/Android test sources belonging
  to the native implementation

Do not place FocusFlow tests in the mockup sandbox, the desktop
`FocusFlow-pc` application, or a shared workspace test directory. Do not
modify the mockup-sandbox workflow just to run FocusFlow tests.

Recommended test layout, to be confirmed against the discovered runner:

```text
artifacts/focusflow/
  tests/
    unit/                 # pure TypeScript utilities and calculations
    services/             # React/service orchestration with mocks
    contracts/            # React↔Kotlin payload and state fixtures
    components/           # React component behavior, if supported
  test-fixtures/          # deterministic shared inputs; no secrets or user data
  test-reports/           # local output only; do not commit generated reports
  android-native/
    ...                   # native source of truth and native test support
```

Kotlin tests should use standard Gradle `src/test` and `src/androidTest`
source sets when the generated Android project is committed and stable. If
`expo prebuild --clean` regenerates or deletes that project, do not keep the
only copy of a test under `artifacts/focusflow/android/`. Keep the source test
under the durable FocusFlow/native source boundary and extend
`android-native/install.sh` or the established native integration mechanism
to install it into the generated project. The agent must verify this behavior
before choosing the final Kotlin path.

---

## 1. Rules for the Test Implementation Agent

### 1.1 Inspect before implementing

Before writing test files:

1. Confirm the JavaScript test runner and command supported by this repository.
2. Confirm how `android-native` is compiled into the actual APK.
3. Confirm whether a generated Android project is available for local JVM or
   instrumented tests.
4. Locate any existing test configuration or hidden build-time test command.
5. Run the existing typecheck/build command before changing test infrastructure.

The current repository does not contain an established FocusFlow test suite.
The lockfile contains some Jest-related packages transitively, but that alone
does not establish a usable test configuration.

### 1.2 Do not copy architecture from reference projects

The reference scenarios are useful only as ideas:

- usage/session boundaries
- blocking decisions
- time and schedule boundaries
- anti-bypass and recovery behavior
- persistence corruption
- UI/content interception

Do not introduce another app's `Rule`, `Verdict`, `BreakLevel`, datastore,
Compose, or multi-module architecture into FocusFlow.

### 1.3 Do not create production code only to satisfy a test

Prefer testing existing public behavior. If a Kotlin method is too large or
private to test safely:

1. First determine whether the behavior can be tested at the service boundary.
2. If not, propose the smallest production seam that represents an existing
   business rule.
3. Keep parsing, policy, and time calculations separate from Android lifecycle
   code only when that improves the actual design, not merely test coverage.
4. Do not use reflection against private methods as the default strategy.

### 1.4 Time must be deterministic

Tests involving `Date`, `dayjs`, `Calendar`, UsageStats, daily allowances,
task expiry, or rolling windows must control time. Do not rely on the machine's
current clock or timezone.

Every time-sensitive test must state:

- timezone
- current timestamp
- expected local calendar date
- whether the boundary is inclusive or exclusive

### 1.5 Test safety behavior explicitly

FocusFlow is an enforcement app. Tests must cover both:

- intended blocking/protection behavior
- intentional exemptions and escape routes that must remain available, such as
  allowing FocusFlow itself, allowing configured focus apps, and preserving
  emergency/system safety behavior where implemented

Do not define "more blocking" as automatically correct.

---

## 2. Test Layers

### 2.1 JavaScript unit tests

Use for pure functions and deterministic orchestration:

- scheduler calculations
- task lifecycle
- password strength and hashing
- PIN reuse tracking with mocked native storage
- serialization and migration helpers
- report/stat formatting helpers

These should be the first tests implemented.

### 2.2 JavaScript service tests

Use mocks for:

- database functions
- SharedPrefs bridge
- native modules
- notifications
- navigation
- AppState

Test observable call order, state transitions, and error handling. Avoid
asserting incidental implementation details such as exact local variable names.

### 2.3 Kotlin JVM/policy tests

Use for pure Kotlin policy or reducer logic if a supported JVM test source set
exists. Good candidates include:

- package blocking decisions
- allowance calculations
- greyout window calculations
- UsageStats event reduction
- JSON parsing with safe defaults

If the current monolithic service prevents this, extract the smallest
business-rule helper only after confirming the Android build path.

### 2.4 Android/Robolectric tests

Use where Android framework behavior matters:

- SharedPreferences interactions
- BroadcastReceiver handling
- UsageStats permission checks
- intent construction
- service startup guards
- package-manager launchability checks

Do not pretend a plain JVM test proves Android lifecycle behavior.

### 2.5 Instrumented/device tests

Reserve for behavior that cannot be proven in JVM tests:

- AccessibilityService window events
- actual overlay display/dismissal
- notification/service lifecycle
- VPN permission and revocation
- launcher/default-home behavior
- OEM-specific settings pages

These may require a real APK and device/emulator. Document them separately
from fast unit tests.

### 2.6 Cross-layer contract tests

These are the tests that involve both React/TypeScript and Kotlin behavior.
They must not be treated as ordinary React unit tests or as proof that the
Android lifecycle works.

Use two complementary forms:

1. **Boundary contract tests** — run quickly in JavaScript and Kotlin
   independently against the same documented payloads and state transitions.
   Verify that:
   - TypeScript writes the exact SharedPreferences keys and JSON shapes that
     Kotlin reads.
   - Kotlin event payloads such as `TASK_TICK`, `TASK_ENDED`, `APP_BLOCKED`,
     `FOCUS_START`, and `FOCUS_STOP` can be parsed by the TypeScript bridge.
   - null, missing, old-version, malformed, and unavailable-native states are
     handled consistently on both sides.
   - task IDs, session IDs, timestamps, package names, enabled flags, and
     remaining durations retain their meaning across the boundary.
   - a task edit, completion, deletion, focus stop, or restart cannot leave
     a stale notification or native session.

2. **End-to-end Android tests** — build/install the actual Android artifact and
   exercise the JavaScript bridge plus the Kotlin service on an emulator or
   device. Use these for:
   - starting and stopping focus from the React UI
   - receiving native events in the running app
   - persistence across app reload and process death
   - notification actions that mutate state and return to the app
   - SharedPreferences/SQLite/native-service reconciliation

A JavaScript mock that returns successful native calls is not an end-to-end
test. It is valid only for testing React orchestration and failure handling.

### 2.7 Test activation matrix

Every test file must be labeled by layer and have a documented command.
The implementing agent must fill in the actual command names after inspecting
the repository and Android build setup.

| Test kind | What it proves | Where it runs | How it is activated |
|---|---|---|---|
| React/TypeScript unit | Pure calculations and reducers | Node/Jest/Vitest/etc. | FocusFlow package script for fast tests |
| React service/orchestration | JS call order, state transitions, UI-facing failures | Node with mocks | Separate JS service-test script or test filter |
| Kotlin policy/JVM | Blocking, schedules, allowances, UsageStats reducers | Android JVM test task | Gradle JVM test task |
| Kotlin Android/Robolectric | Preferences, intents, receivers, package manager behavior | JVM with Android simulation | Gradle Robolectric/Android test task |
| Boundary contract | Shared payloads and cross-language state meaning | JS plus Kotlin fixtures | Dedicated contract test command; never hidden inside unit tests |
| Instrumented/device | Real services, notifications, VPN, overlays, lifecycle | Emulator or physical Android device | Explicit connected/instrumented test command |
| Full validation | Typecheck plus all available test layers | Repository/CI or documented local sequence | One top-level FocusFlow validation command |

The agent must not invent a command unsupported by the checked-out toolchain.
If a layer cannot run in the current environment, document it as unavailable
with the exact reason and the command needed on a capable Android environment.

### 2.8 CI and workflow organization

The number of test cases must not determine the number of workflows. Do not
create one GitHub Actions workflow, Replit workflow, or Actions job per feature
or per test file.

Use a small execution model:

- **One primary FocusFlow test workflow** for pull requests and manual runs.
- **One job for fast JavaScript tests**: typecheck, React unit tests, service
  tests, and contract-fixture checks that can run on Node.
- **One job for Android JVM/Robolectric tests**: Kotlin policy and Android
  framework tests, when the generated Android project supports them.
- **One optional device job**: instrumented/emulator tests, manual or
  scheduled rather than required for every quick edit if they are slow or
  resource-heavy.
- **Existing build/release/security workflows remain separate** because they
  serve different purposes; do not duplicate their APK build steps in every
  test job unless required.

Prefer one job with test filters or grouped commands over many jobs when the
tests share the same setup. Use a matrix only for genuinely different Android
API levels or device profiles, and keep that matrix small and intentional.
Test-case names should appear in test reports and job summaries, not as
separate workflow entries.

Replit workflows are for serving and previewing the application, not for
pretending to provide Android Studio, an emulator, or a complete native test
environment. The implementation agent may run JavaScript/typecheck commands
in Replit, but Android JVM, instrumented, and emulator tests should run through
the repository's GitHub Actions workflow when local Android tooling is absent.

The CI workflow must fail for real test failures while reporting unavailable
device infrastructure separately. It must not silently mark all Android tests
as passed because the emulator was unavailable.

### 2.9 Test gates, reports, and maintenance

Not every test layer needs to run on every code change. The execution policy
should be:

- **Every pull request:** typecheck, fast JavaScript tests, contract fixtures,
  and available Kotlin JVM/Robolectric tests.
- **Android/native changes:** also run the Android build and the relevant
  native test groups.
- **Scheduled or manual runs:** emulator/device tests, OEM-sensitive flows,
  reboot/process-death checks, and longer concurrency runs.
- **Before release:** the complete available matrix, CodeQL review, and an
  explicit report of any device-only coverage that could not run.

The grouped workflow should upload machine-readable test results, failed-test
output, Android build reports, and device logcat where applicable. The job
summary should include counts by layer and clearly distinguish:

- passed
- failed
- blocked by environment
- not applicable

Do not use a blanket `continue-on-error` for test commands. If a test is
genuinely flaky, reproduce it, identify the cause, and either fix it or place
it in a visibly tracked quarantine with an owner and expiry condition. A
quarantined test must not be counted as passing coverage.

Keep a stable mapping from each feature section in this plan to its test
files and command/filter. This makes it possible to identify which behavior
is covered when a test moves or a native implementation changes.

### 2.10 CodeQL and security-evidence review

CodeQL review is a separate stage after the Replit-local test stage. The
implementation agent must not use CodeQL findings as a substitute for tests,
and passing tests must not be treated as proof that the code is secure.

The required order is:

1. Establish and run the Replit-local JavaScript/typecheck tests.
2. Fix genuine local failures and record unavailable Android layers honestly.
3. Run or inspect the GitHub Actions build/test results for the FocusFlow
   Android artifact.
4. Only after those stages are satisfactory, review the relevant GitHub
   CodeQL history and closed cases.
5. Compare each relevant closed finding with the current code under
   `artifacts/focusflow/`, including `src`, `app`, `android-native`, native
   build/install scripts, and generated-project patches where applicable.
6. Confirm that the closed case is still fixed, intentionally accepted with
   documented reasoning, or has reappeared in a changed implementation.

Scope rules:

- Review only CodeQL alerts, issues, and closed cases relevant to FocusFlow
  under `artifacts/focusflow/`.
- Ignore findings belonging to `FocusFlow-pc`, mockup/demo artifacts,
  unrelated packages, or historical code that is not part of the mobile app.
- Do not reopen or modify closed GitHub cases merely because they are old.
  Reopen/escalate only when the current FocusFlow code demonstrates that the
  underlying risk returned or was never actually resolved.
- Check both JavaScript/TypeScript and Java/Kotlin analysis where GitHub
  provides them.
- Treat a CodeQL workflow pass as analysis evidence, not as proof that runtime
  Android behavior passed.
- Add a regression test for a relevant security finding when the risk has a
  reproducible behavioral contract. Do not add artificial tests for a
  purely static or already-inapplicable alert.

The agent must produce a concise security review table containing the finding
category, affected FocusFlow path, current status, evidence checked, and
follow-up needed. It must not claim that unrelated closed cases were reviewed.

GitHub access must be provided through the approved workspace integration or
secret mechanism. Never paste a personal access token into test files, logs,
the repository, or chat. If access is not yet available, complete the local
test work first and mark the GitHub CodeQL review as pending rather than
guessing at its contents.

### 2.11 What the implementation agent should remember

The implementation agent should record only durable, non-obvious constraints
in its project memory, such as:

- FocusFlow tests stay inside `artifacts/focusflow/`.
- React-only, Kotlin-only, contract, and device tests are separate evidence
  layers.
- Generated Android output must never be the only durable home of native tests.
- Local tests come before GitHub Actions and CodeQL review.
- Closed CodeQL findings are reviewed only when relevant to the current
  FocusFlow artifact.

The agent should not store a test-by-test changelog, test counts, file lists
that can be found by searching the repository, tokens, GitHub credentials,
device data, or temporary CI results in memory. The committed plan and test
inventory are the source of truth for those details.

---

## 3. Feature: Task Creation and Task Lifecycle

Primary code areas:

- `src/data/types.ts`
- `src/services/taskService.ts`
- task screens and task components
- `src/data/database.ts`

### 3.1 Task construction

Test:

- title and required start time are preserved
- end time equals start time plus duration
- default priority is `medium`
- default color is the FocusFlow default
- default tags and reminders are empty arrays
- default focus mode is disabled unless requested
- explicit focus-allowed packages are preserved
- generated IDs are non-empty and distinct
- `createdAt` and `updatedAt` are present

### 3.2 Status transitions

Test:

- scheduled → active
- scheduled → completed
- scheduled → skipped
- unresolved tasks remain identifiable after their end time
- completed and skipped tasks are not treated as active
- status updates refresh `updatedAt`
- updating status does not mutate unrelated task fields

### 3.3 Current and active task selection

Test:

- a task currently inside its scheduled interval is active
- a task exactly at its start boundary follows the existing intended boundary
- a task exactly at its end boundary is no longer active
- an ended unresolved task is still returned as the current task for user
  resolution
- the most recently ended unresolved task wins
- completed/skipped ended tasks are ignored
- a future task is not returned as current

### 3.4 Extending and shifting

Test:

- extending updates both end time and duration
- extending does not alter the original start time
- shifting later tasks moves start and end by the same duration
- completed/skipped tasks are not shifted
- the task being extended is not shifted as a later task
- updated timestamps change on modified tasks

### 3.5 UI behavior

Test at the component/screen level only if the test harness supports React
Native:

- required title/duration validation prevents invalid creation
- edit saves the changed values
- cancel leaves the task unchanged
- completion shows the expected completed state
- skip shows the expected skipped state
- expired unresolved tasks offer complete, extend, and skip actions
- database failures show an error state rather than falsely showing success

---

## 4. Feature: Schedule Conflict Detection and Rebalancing

Primary code area: `src/services/schedulerEngine.ts`.

### 4.1 Conflict detection

Test:

- overlapping tasks are detected
- tasks that only touch at end/start are not overlapping
- the task with the same ID is ignored
- completed tasks are ignored
- skipped tasks are ignored
- overlap minutes are calculated from the intersection, not full durations
- multiple conflicts are all returned

### 4.2 Safe insertion

Test:

- a non-conflicting task is returned unchanged
- lower-priority conflicting tasks are shifted
- equal-priority tasks remain for user resolution
- higher-priority tasks remain for user resolution
- shifting one task does not create a later overlap
- tasks that ended before the inserted task are never moved
- completed/skipped tasks never enter the shift chain
- the five-minute placement buffer is honored

### 4.3 Overrun rebalance

Test:

- overrun duration is applied to subsequent tasks
- critical tasks are reported in `needsUserConfirm`
- high-priority tasks shift automatically
- medium/low tasks follow the configured maximum auto-shift threshold
- low/medium tasks skipped to free space retain their other fields
- tasks before the overrun task remain unchanged
- resolved tasks are excluded
- zero or negative overrun does not shift anything

### 4.4 Schedule compression

Test:

- early completion pulls later tasks forward
- completion at or after planned end does not compress
- only tasks after the completed task's planned end are moved
- completed/skipped later tasks remain unchanged
- the saved gap is applied consistently to both start and end

### 4.5 Schedule health

Test:

- overlaps are reported in chronological order
- gaps over 15 minutes are reported
- gaps of exactly 15 minutes follow the current intended threshold
- skipped tasks do not create false overlap reports
- total scheduled minutes are calculated correctly
- multi-hour tasks distribute minutes into the correct hours
- overloaded hours are reported only above 60 minutes

---

## 5. Feature: Focus Sessions

Primary code areas:

- `src/services/focusService.ts`
- `src/hooks/useTimer.ts`
- `src/hooks/usePomodoro.ts`
- `src/context/AppContext.tsx`
- `src/native-modules/ForegroundServiceModule.ts`
- `src/native-modules/SharedPrefsModule.ts`

### 5.1 Starting focus

With database and native modules mocked, test:

- an active previous session is stopped before a new one starts
- a focus session row is created with the task ID
- allowed packages are preserved
- invalid non-package allow-list values are filtered as currently intended
- an empty allow-list writes the block-all sentinel
- the foreground service receives task ID, title, start, end, and next-task data
- battery optimization exemption is requested
- home navigation occurs unless `skipGoHome` is true
- focus state and active task are written to SharedPreferences
- the active task color is synchronized
- an AppState listener is installed once

### 5.2 Stopping focus

Test:

- focus state is cleared even if JavaScript did not know about the active
  native session
- the foreground service is stopped
- native focus state is cleared
- allowed packages are cleared
- active task state is cleared
- a real active database session is ended
- no fake database end is written for a cold-start cleanup
- persistent notification is dismissed for a real session
- native cleanup failures follow the existing best-effort behavior
- repeated stop calls do not leak subscriptions or create duplicate writes

### 5.3 Focus completion policy

Test both settings:

- completing a task stops focus when `keepFocusActiveUntilTaskEnd` is false
- completing a task keeps enforcement active until the scheduled end when the
  setting is true
- task statistics still record completion independently of enforcement state

### 5.4 Pomodoro behavior

Test:

- focus duration countdown reaches zero
- break starts with the configured duration
- break completion resumes focus when configured
- pausing/resuming does not add extra time
- stopping focus cancels break timers
- notification state matches focus versus break state
- invalid durations do not create negative timers

---

## 6. Feature: Focus App Allow-List

### 6.1 JavaScript configuration

Test:

- global allowed apps are saved and reloaded
- task-specific allowed apps override the global list when defined
- `undefined` means use global settings
- an empty task-specific list means the task's intentional empty-list
  behavior, not an accidental missing value
- preset allow-lists save and load without mutation

### 6.2 Android enforcement

Test:

- focus-active plus an allowed package permits that package
- focus-active plus an unlisted package blocks it
- package comparison follows the current case-sensitivity contract
- FocusFlow's own package is never blocked
- malformed allowed-list JSON does not crash the service
- focus cleanup stops blocking after the native state is cleared

---

## 7. Feature: Standalone Timed Blocking

Primary areas:

- standalone block screen/modal
- `SharedPrefsModule`
- `AppBlockerAccessibilityService`
- `ForegroundTaskService`

Test:

- selected packages are written to native state
- the configured expiry timestamp is written correctly
- listed packages block while the session is active
- unlisted packages remain allowed under standalone rules
- expiry stops standalone enforcement
- an expired session is not restored after restart
- stopping standalone clears active state but preserves configured lists where
  the UI contract says lists are reusable
- standalone mode can operate without a focus task
- malformed package JSON does not crash enforcement

---

## 8. Feature: Always-On Blocking

Test:

- the always-on master toggle controls enforcement
- disabling enforcement preserves `alwaysOnPackages`
- enabled always-on blocks its listed packages without a focus session
- enabled always-on does not block unlisted packages
- always-on enforcement survives focus-session start/stop
- timed standalone expiry does not accidentally delete explicit always-on apps
- auto-copied packages are removed only according to the documented auto-copy
  behavior
- system/self exemptions still apply

---

## 9. Feature: Daily Allowances

FocusFlow supports `count`, `time_budget`, and `interval` modes. These must be
tested independently and through the fallback service.

### 9.1 Count mode

Test:

- first open is allowed
- an open at the configured daily count is blocked
- opens for another package do not consume this package's count
- count resets on a new local date
- repeated same-package accessibility events do not double-count one open
- malformed stored usage does not crash enforcement

### 9.2 Time-budget mode

Test:

- usage below the budget is allowed
- usage exactly at the budget is blocked
- usage above the budget is blocked
- usage resets on a new local date
- usage is accumulated only while the target app is actually foreground
- screen-off time is not charged
- a service reconnect does not charge the unavailable interval unless the
  documented checkpoint says it should

### 9.3 Interval mode

Test:

- usage below the interval allowance is allowed
- usage at the allowance is blocked
- a new rolling window resets usage
- the window boundary is deterministic and documented
- process/service restart does not incorrectly reset a still-active window
- unrelated package usage does not consume the target package's interval

### 9.4 Fallback enforcement

Test:

- fallback polling runs when AccessibilityService is unavailable
- always-on-only configuration activates fallback polling
- daily-allowance-only configuration activates fallback polling
- current foreground detection uses the latest foreground event
- no foreground event returns no package
- UsageStats errors fail safely
- fallback blocks an exhausted allowance
- fallback allows an unexhausted allowance
- fallback reads the same SharedPreferences state written by accessibility
  enforcement

---

## 10. Feature: Greyout and Recurring Schedules

Primary areas:

- `src/data/types.ts`
- `src/services/schedulerEngine.ts`
- `src/services/setupPersistence.ts`
- `GreyoutScheduleModal`
- Kotlin greyout matching

### 10.1 Normal windows

Test:

- a package is blocked inside a same-day window
- exact start follows the intended inclusive boundary
- exact end follows the intended exclusive boundary
- the package is allowed outside the window
- configured weekdays are respected
- disabled recurring schedules produce no active window

### 10.2 Overnight windows

Test:

- a 22:00–06:00 window blocks at 23:00
- it blocks at 05:00 the next calendar day
- it does not block at 06:00
- the before-midnight portion belongs to the configured start day
- the after-midnight portion belongs to the previous configured day
- Sunday/Monday wraparound is correct

### 10.3 Multi-package and migration behavior

Test:

- legacy single `pkg` entries still work
- `pkgs` entries match any listed package
- an unrelated package is not blocked
- malformed entries are ignored safely
- recurring schedules sync to greyout windows without dropping unrelated
  schedules
- deleting a schedule removes only its generated windows

---

## 11. Feature: Blocked Words

Primary areas:

- `BlockedWordsModal`
- AppContext/settings persistence
- accessibility text collection and matching

Test:

- words save and reload
- empty words do not block
- matching behavior follows the current case-sensitivity contract
- a matching word triggers the documented home/overlay action
- unrelated text does not trigger
- malformed stored word lists do not crash the service
- self-owned FocusFlow screens remain exempt where intended
- multiple words behave independently

If matching is based on accessibility node text, include Android tests with:

- shallow text
- nested child text
- empty nodes
- duplicate node text
- very large text trees

---

## 12. Feature: YouTube Shorts and Instagram Reels Guards

These are content-specific accessibility guards, not generic URL blockers.

Test:

- the parent app remains usable when the content guard is disabled
- the Shorts/Reels surface is intercepted only when its toggle is enabled
- the matching package/class/resource/text combination is recognized
- unrelated screens in the same app are allowed
- focus/standalone activation gates the guard according to the settings contract
- disabling the relevant guard stops interception
- malformed accessibility events do not crash the service
- retry behavior does not create an infinite loop

Do not copy browser address-bar or domain-normalization tests from another app;
FocusFlow does not use that architecture for these guards.

---

## 13. Feature: Installer, Uninstall, and System Protection

Primary areas:

- `AppBlockerAccessibilityService`
- `PackageInstallReceiver`
- `NuclearModeModule`
- launcher uninstall protection
- system guard settings

### 13.1 Explicit system-control gate

Test:

- installer/uninstall interception is inactive when system protection is off
- enabling the explicit protection toggle activates interception
- disabling it stops interception
- unrelated settings pages are not blocked

### 13.2 Install/update/uninstall dialogs

Test supported package/class variants for:

- Play Store
- Android package installer
- known OEM installers already handled by the code
- known OEM Settings pages already handled by the code

For each relevant target:

- the confirmation dialog is recognized when protection is active
- the service redirects/dismisses according to the current behavior
- normal app browsing is not blocked
- malformed or missing accessibility roots fail safely

### 13.3 Nuclear uninstall flow

Test:

- uninstall request launches the system dialog rather than deleting silently
- a single app request targets the requested package
- multiple-app requests handle each package according to the current contract
- missing/uninstalled packages are reported safely
- FocusFlow cannot uninstall itself through this path

---

## 14. Feature: Defense Password and PIN Rotation

Primary areas:

- `pinCrypto.ts`
- `pinReuseTracker.ts`
- PIN setup/verify/rotation modals
- `SessionPinModule`

### 14.1 Password rules

Test:

- empty password is invalid
- fewer than eight characters is invalid
- strength levels reflect length and character variety
- common weak passwords are identified by the current policy
- a valid password can be hashed and verified
- a wrong password fails verification
- hashes do not expose the plaintext

### 14.2 Protection gate

Test:

- disabling protected enforcement requires the PIN when protection is enabled
- toggles work without a PIN when PIN protection is disabled
- a wrong PIN leaves enforcement unchanged
- a correct PIN permits the intended action
- canceled verification leaves state unchanged
- native verification failure is shown as failure, not success

### 14.3 Reuse cap

Test:

- reuse count starts at zero
- same-day count is read correctly
- a stale-date count resets
- reuse is allowed below the cap
- reuse is disallowed at the cap
- recording reuse increments count and stores today’s local date
- native storage errors fail conservatively without crashing

---

## 15. Feature: Network/VPN Blocking

Primary areas:

- `NetworkBlockModule.ts`
- `NetworkBlockerVpnService.kt`
- `VpnWatchdogReceiver.kt`
- `VpnPermissionLostBanner`

Test:

- focus starts VPN blocking only when VPN blocking is enabled
- configured standalone VPN packages are passed correctly
- stop focus stops VPN blocking
- always-on VPN packages remain distinct from overlay block packages
- global versus per-app mode is encoded correctly
- missing VPN permission does not crash the app
- a user revocation updates the reported status
- watchdog does not restart when self-healing is disabled
- watchdog does not restart when network blocking is disabled
- watchdog does not restart without permission
- watchdog does not restart when no qualifying active/persistent policy exists
- watchdog attempts recovery only when every guard is satisfied
- an already-running VPN is not started twice
- another active VPN is reported as a conflict rather than missing FocusFlow consent
- process-death recovery exposes desired versus applied policy generation
- receiver recovery dispatches immediately for boot/unlock/watchdog paths
- rejected background service starts persist an honest startup-failure state

---

## 16. Feature: Accessibility Permission, Usage Access, and Onboarding

Primary areas:

- onboarding and permissions screens
- `UsageStatsModule.ts`
- `UsageStatsModule.kt`
- `setupPersistence.ts`

### 16.1 Permission tiers

Test:

- the three required first-run permissions gate readiness
- recommended permissions do not prevent basic onboarding completion
- optional personalization does not block readiness
- unavailable native modules do not crash onboarding
- returning from Android settings refreshes permission state
- restricted-settings guidance appears only when the OS reports it is needed
- installer-specific guidance uses the actual installer result

### 16.2 Native bridge fallback behavior

Test:

- non-Android calls return safe defaults
- missing native modules return safe defaults
- native promise rejection is handled for optional checks
- settings-opening methods do not fabricate granted status
- usage summary unavailable state renders an honest empty/unavailable state

### 16.3 UsageStats summary

Test:

- sessions are clipped to the requested range
- a session still foreground at query end is counted correctly
- repeated same-package resumed events do not reset the session start
- launch count does not increase for same-package resume noise
- sub-500 ms blips are excluded
- non-launchable/system packages are excluded
- total minutes equal the displayed filtered app durations
- Android Q+ and pre-Q event types use the correct event constant

---

## 17. Feature: Statistics, Reports, and Streaks

Primary areas:

- stats tab
- reports screen
- `database.ts`
- UsageStats bridge
- `daily_completions`

Test:

- today's focus minutes are calculated from session intervals
- active sessions use the current time
- ended sessions use their end time
- negative/invalid intervals do not reduce totals
- local date boundaries are correct
- yesterday/week/all-time queries use the intended date range
- task completion rates exclude the intended statuses
- blocked attempts are counted from the correct source
- streaks handle consecutive local dates
- missing days break streaks according to product rules
- empty data renders zero/empty copy rather than NaN or misleading values
- formatting of minutes, hours, percentages, and durations is consistent
- the report does not claim device usage when Usage Access is unavailable

---

## 18. Feature: Notifications, Alarms, and Background Tasks

Primary areas:

- `notificationService.ts`
- `backgroundTasks.ts`
- `TaskAlarmModule`
- `TaskAlarmActivity`
- `TaskEndAlarmReceiver`

Test:

- notification permission denial is handled
- notifications are not scheduled when disabled
- reminders use the correct offset and task time
- duplicate scheduling does not create duplicate reminders
- canceling a task cancels its reminders
- rescheduling an edited task cancels the old identifiers before creating the
  new schedule
- changing only a task title updates notification content without leaving old
  title notifications scheduled
- changing start or end time updates both Expo notification triggers and the
  Android AlarmManager backup
- completed, skipped, and overdue tasks do not consume notification slots
- a task with a start time too close to now does not create already-past
  reminders
- short tasks receive only the check-ins that satisfy the configured headroom
  rules
- the one-minute warning and end notification are not duplicated
- notification identifiers are stable and include the task identity
- duplicate task IDs in batch scheduling are de-duplicated
- batch scheduling shares one slot budget across all tasks
- reaching the notification capacity skips excess schedules without corrupting
  schedules for earlier tasks
- Android AlarmManager cancellation happens alongside Expo cancellation
- a failed cancellation or scheduling operation does not prevent later tasks
  from being processed
- task-end alarms use the task ID and expected timestamp
- expired/canceled tasks do not fire stale alarms
- background tasks can be registered idempotently
- background task failures are logged and do not crash the app
- exact-alarm unavailable state is surfaced honestly

### 18.1 Notification content and categories

Test:

- reminder notifications use the reminder category
- start/end/check-in notifications use the active-task category
- task ID and action type are present in notification data
- notification channel IDs match the notification type
- the task title, end time, and duration use the same formatting as the UI
- notification text handles long titles safely
- morning digest text handles no tasks, completed tasks, skipped tasks, and
  more than three completed task names
- weekly report uses the configured weekday
- weekly report uses the configured wake-up time or the documented 09:00
  fallback
- invalid wake-up times do not schedule a malformed notification
- standalone expiry notification is replaced rather than duplicated
- standalone expiry cancellation is safe when no notification exists

### 18.2 Background overrun handling

Test:

- an overrun event with the wrong type is ignored
- an overrun event without a task ID is ignored
- a missing task is ignored
- a completed or skipped task is not extended
- a live task is extended by the documented default amount
- the extended task and all shifted tasks are persisted together
- reminder schedules are rebuilt after the overrun
- a persistence failure does not partially claim that the schedule was updated
- repeated delivery of the same overrun event does not extend the task twice if
  the persisted state makes it identifiable as already handled

### 18.3 Background fetch recovery

Test:

- completed and skipped tasks are not re-armed
- overdue tasks are not re-armed as upcoming reminders
- tasks three to fifteen minutes late receive the late-start warning
- tasks less than three minutes late do not receive the warning
- tasks more than fifteen minutes late do not receive repeated late warnings
- upcoming tasks are re-armed in one batch
- no-data and new-data results are returned consistently
- evening fetch schedules the morning digest only when a wake-up time exists
- repeated evening fetches replace the digest instead of duplicating it
- restricted/denied background fetch does not attempt registration
- registration treats an already-registered task as success

### 18.4 Background notification actions

Test:

- foreground app state leaves the action to the foreground listener
- background/killed app state lets the headless task own the action
- missing task IDs are ignored
- `COMPLETE` updates the task and cancels its reminders
- `EXTEND` updates the task, rebalances subsequent tasks, and rebuilds
  reminders
- `VIEW` navigates to the task without mutating it
- unknown actions do not mutate the task
- an action for a deleted task is ignored
- duplicate action delivery does not apply completion/extension twice
- background action errors are caught and logged

---

## 19. Cross-Layer Synchronization Contracts

This section is central to FocusFlow. A feature is not correct merely because
one store changes. The same user action can affect:

1. SQLite task/settings data
2. React Context state
3. SharedPreferences consumed by Kotlin
4. the foreground service
5. AccessibilityService enforcement
6. Expo scheduled notifications
7. native AlarmManager alarms
8. navigation/UI presentation

Tests should assert the final coherent state across all applicable layers.

### 19.1 Task creation synchronization

When a task is created, test:

- SQLite contains the new task
- React state contains the new task after refresh
- reminders are scheduled only after the task has valid persisted identity
- the task's reminder data references the same task ID
- a focus-mode task does not start enforcement merely because it was created
- a failed reminder schedule does not delete or falsify the database task
- a failed database write does not leave a success-only notification schedule

### 19.2 Task edit synchronization

When a task is edited, test:

- SQLite receives the new task values
- React state replaces the old task rather than appending a duplicate
- old reminders are canceled
- new reminders reflect the new title/start/end/duration
- the native AlarmManager backup reflects the new end time
- if the edited task is currently focused, the active focus snapshot is updated
- if the task's allowed packages change during focus, SharedPreferences is
  updated according to the existing product contract
- an edit failure leaves the previous coherent state intact

### 19.3 Task completion synchronization

When a task is completed, test:

- task status is persisted as completed
- the UI immediately stops treating it as active/current
- task reminders are canceled
- its end alarm is canceled
- an active focus session stops or remains active according to
  `keepFocusActiveUntilTaskEnd`
- the native active-task state is cleared or retained consistently with that
  setting
- daily completion/streak data is updated once
- reports do not count the same completion twice

### 19.4 Task skip and delete synchronization

When a task is skipped, test:

- status is persisted as skipped
- reminders and native alarms are canceled
- it no longer contributes to the scheduled-task denominator where excluded
- it does not trigger an overrun recovery

When a task is deleted, test:

- the task row is removed
- all Expo reminders for that task are canceled
- the native AlarmManager alarm is canceled
- an active focus session is ended before the task row is removed
- active native task state is cleared
- unrelated task reminders and block settings remain unchanged
- deleting a task does not delete its unrelated historical override records
  unless that is an explicit product rule
- repeated deletion is idempotent

### 19.5 Focus state synchronization

For focus start/stop, test the state machine across:

- React `focusActive`
- current task snapshot
- SQLite `focus_sessions`
- SharedPreferences `focus_active`
- SharedPreferences `active_task_*`
- SharedPreferences `allowed_packages`
- native foreground service running/stopped
- accessibility enforcement active/inactive
- VPN active/inactive when enabled
- persistent native notification visible/cleared

Test:

- successful start reaches one consistent active state
- successful stop reaches one consistent inactive state
- failure in one downstream step is logged and the remaining cleanup path
  still runs
- starting twice does not create two active database sessions
- stopping twice does not create duplicate end writes
- a cold start can reconcile native-active state with missing JS memory
- stale native active-task state is cleared when no database session exists

### 19.6 Settings synchronization

For each setting that affects native behavior, test:

- the setting is saved in SQLite
- AppContext reloads the saved value
- the corresponding SharedPreferences key is updated
- disabling the setting does not accidentally erase its configured list
- changing unrelated settings does not rewrite or drop this setting
- malformed settings use defaults without falsely enabling enforcement

At minimum cover:

- focus mode and allowed packages
- standalone block packages and expiry
- always-on toggle and package list
- daily allowance configuration and usage
- greyout schedule
- system/install/Shorts/Reels guards
- VPN mode, package list, and self-healing
- PIN protection
- launcher settings
- overlay quotes/wallpaper
- aversion deterrents

### 19.7 Native event bridge synchronization

Primary code area: `src/services/eventBridge.ts`.

Test:

- non-Android initialization is a no-op
- missing native bridge does not crash initialization
- one native emitter subscription is created
- repeated initialization does not leak multiple subscriptions if the current
  lifecycle calls it more than once
- subscribers receive only their matching event type
- multiple subscribers receive the same event
- unsubscribe removes only that handler
- unknown event types do not crash dispatch
- one throwing handler does not prevent other handlers from receiving the event
- destroy removes the native subscription and handlers
- event payloads preserve task ID, remaining seconds, blocked app, permission,
  and notification action values

### 19.8 Native event effects

Test the consumer behavior for:

- `TASK_TICK` updates the visible timer without writing a new task each tick
- `TASK_ENDED` marks/reconciles the correct task only once
- `APP_BLOCKED` increments/logs the correct blocked attempt
- `FOCUS_START` and `FOCUS_STOP` do not fight the local focus state
- `SERVICE_RESTART` refreshes native health and active-task state
- `BOOT_COMPLETED` refreshes schedule/enforcement state
- `PERMISSION_RESULT` refreshes the specific permission state
- `BATTERY_LOW` surfaces a warning without disabling user settings silently
- `NOTIF_ACTION` is not processed by both foreground and background owners

### 19.9 App reload and resume synchronization

Test:

- app launch loads SQLite settings/tasks before presenting enforcement-dependent
  UI
- app resume probes database health before resetting a healthy handle
- app resume refreshes permissions
- app resume reconciles active focus state
- app resume does not duplicate scheduled reminders
- app resume does not restart an expired focus or standalone session
- an interrupted database operation does not overwrite newer in-memory state
- an old async refresh result cannot replace a newer task/settings snapshot

### 19.10 Cross-layer failure matrix

For each major operation, inject failure at each layer and assert the result:

| Operation | SQLite fails | SharedPreferences fails | Native service fails | Notifications fail |
|---|---|---|---|---|
| Start focus | no false active session | service can be cleaned up | visible error/recovery | focus still has honest state |
| Stop focus | native cleanup still runs | native cleanup remains best effort | UI does not claim clean stop | notification failure is non-fatal |
| Edit task | old task remains coherent | old native rule remains coherent | edit is not falsely reported complete | old schedule is not lost |
| Complete task | status is not claimed saved | native state follows policy | UI shows recoverable failure | stale reminders are addressed |
| Enable block | setting is not falsely persisted | enforcement does not claim active | clear error state | unrelated schedules remain |

The exact recovery behavior must follow the current product contract; the test
must not invent silent success.

---

## 20. Feature: Database, Settings, Backup, and Import

---

Primary areas:

- `src/data/database.ts`
- `src/services/backupService.ts`
- `src/services/setupPersistence.ts`

### 20.1 Database schema and mapping

Test:

- default schema initializes
- migrations are idempotent
- task rows map to TypeScript task objects correctly
- malformed JSON in one row does not wipe all rows
- focus mode integer maps to boolean
- nullable fields remain nullable/undefined as intended
- settings defaults fill missing properties

### 20.2 Database resilience

Test where the supported mock/integration layer permits:

- concurrent writes complete without lost updates
- writes are serialized
- a dead native handle triggers one recovery attempt
- a successful retry returns the operation result
- a failed recovery reports unavailable state
- repeated unrecoverable calls do not create an uncontrolled retry storm
- read-only fallback callers return their documented fallback

### 20.3 Backup and restore

Test:

- backup includes the expected metadata/version
- export uses the `.focusflow` format/extension contract
- import validates the file before applying it
- invalid or malformed files are rejected safely
- imported settings become pending presets rather than silently overwriting
  live settings
- applying a preset changes only its category
- dismissing a preset leaves live settings unchanged
- unsupported/unknown fields do not crash import

---

## 21. Feature: Home Launcher

Primary areas:

- `home-launcher.tsx`
- `LauncherActivity`
- `SharedPrefsModule`
- launcher settings fields in `AppSettings`

Test:

- launcher enabled state is persisted
- pinned apps preserve ordering
- dock is limited to the supported number of apps
- hidden packages are not shown in the drawer
- only eligible blocked apps can be hidden
- analog and digital clock settings synchronize to native state
- wallpaper setting persists and can be cleared
- default-home guidance opens the correct settings intent
- launcher self-package remains available
- uninstall lock applies only when configured and the qualifying block is active
- stale launcher state is not retained after HOME/task recreation

---

## 22. Feature: Overlay Appearance and Aversion Deterrents

Primary areas:

- `BlockedAppOverlay`
- `OverlayAppearanceModal`
- `BlockOverlayModule`
- `AversionsModule`

Test:

- default quote pool is used when custom quotes are empty
- custom quotes are persisted and restored
- clearing custom quotes returns to defaults
- custom wallpaper can be set and cleared
- overlay settings survive app restart
- blocked app name/reason is displayed correctly
- overlay action delay follows settings
- dimmer/vibration/sound are each independently gated
- deterrents do not run when disabled
- overlay cleanup removes timers, listeners, and window state
- overlay errors do not leave an unrecoverable stale state

---

## 23. Feature: Diagnostics and User-Controlled Reports

Primary areas:

- `startupLogger.ts`
- `diagnosticsReporter.ts`
- `DiagnosticsModal`
- `ReportIssueModal`

Test:

- logs are ordered chronologically
- initialization does not lose entries written during startup
- concurrent writes are serialized
- log trimming follows the configured cap
- clearing logs clears memory and persistence
- diagnostic export sanitizes sensitive values
- report creation remains user-reviewed before sending
- the app does not silently relay diagnostics to a server
- missing mail composer support is shown as an honest failure
- attachment content is text and does not contain secrets or raw credentials

---

## 24. Cross-Cutting Non-Feature Tests

### 24.1 Error boundaries

Test:

- a render failure shows the fallback screen
- retry attempts recovery
- the error screen does not expose sensitive internals
- one screen failure does not corrupt unrelated global state

### 24.2 Persistence corruption

Test malformed:

- settings JSON
- task tags/reminders
- allowed packages
- block packages
- greyout schedules
- allowance configuration
- allowance usage
- backup/import files

Each malformed input must either use the documented safe default or show a
user-visible error. It must not crash the app or silently claim enforcement.

### 24.3 Concurrency and ordering

Test:

- rapid task saves
- task save followed immediately by focus start
- focus stop followed immediately by task completion
- repeated settings toggles
- simultaneous database reads and writes
- simultaneous native state cleanup calls

The assertion should be the final observable state, not a fragile exact timing
sequence unless ordering is itself part of the contract.

### 24.4 Process death and restart

Test:

- app restart during active focus
- Android service restart during an allowance session
- restart after screen-off
- restart after database handle invalidation
- restart with expired standalone block
- restart with active always-on block
- restart with an interrupted VPN

### 24.5 Accessibility and UI quality

Where the React Native test harness supports it, test:

- important controls have accessible labels
- toggles expose their current state
- destructive actions have confirmation
- modal cancel actions work
- loading/error/empty states are distinguishable
- long titles and long package names do not break layout
- keyboard focus/input behavior works in forms

Device-level visual checks should cover at least:

- small Android phone
- large Android phone
- dark mode
- light mode
- long text
- no-data state
- permission-denied state

### 24.6 Reliability and anti-flake requirements

The goal is not merely a large number of passing tests. The suite must produce
repeatable evidence that FocusFlow protects the user without silently losing
state.

Required practices:

- Use fixed clocks, explicit timezones, seeded randomness, and isolated
  temporary databases/files.
- Build reusable fixtures for tasks, focus sessions, settings, package lists,
  notifications, UsageStats events, native events, and SharedPreferences.
- Keep shared boundary fixtures in one canonical format so the TypeScript and
  Kotlin tests exercise the same payload examples.
- Inject failures deliberately: database open/read/write errors, malformed
  JSON, unavailable native modules, rejected permissions, notification
  scheduling failures, service-start failures, process death, and stale
  events.
- Assert safe final state after failures. Never turn a failed native operation
  into a passing “enabled” or “enforced” assertion.
- Run concurrency and ordering cases repeatedly, including rapid repeated
  actions, and assert idempotency of cleanup.
- Separate deterministic failures from environmental failures. An unavailable
  emulator, SDK, or native build must be reported as an unavailable test layer,
  not converted into a skip that looks like success.
- Run fast tests in a clean process and, where practical, repeat them to detect
  order dependence and leaked mocks/timers.
- For device tests, collect logcat, test reports, APK/build information, and
  the exact device/API level on failure.
- Never use real user data, real credentials, or production services in tests.
- Keep tests focused on observable contracts; avoid brittle assertions about
  private call order unless ordering is a documented safety requirement.

Before handoff, the implementation agent must provide a short test inventory
that lists every command, the layer it activates, what it proves, whether it
ran successfully, and any environment limitation. A green React test command
must not be presented as proof that Kotlin enforcement or Android lifecycle
behavior works.

---

## 25. Suggested Delivery Order

### Milestone 1: Fast, pure coverage

Implement:

1. scheduler engine
2. task service
3. PIN crypto
4. PIN reuse tracker
5. deterministic formatting/report helpers

### Milestone 2: Service orchestration

Implement mocked tests for:

1. focus start/stop
2. settings synchronization
3. notification scheduling
4. backup/import validation
5. diagnostics sanitization

### Milestone 3: Persistence

Implement:

1. row mapping
2. settings defaults/migration
3. local-date queries
4. focus-session totals
5. write serialization and recovery where the supported environment allows it

### Milestone 4: Kotlin policy

Implement:

1. focus allow-list decisions
2. standalone and always-on decisions
3. daily allowances
4. greyout windows
5. UsageStats event aggregation
6. fallback enforcement

### Milestone 5: Android lifecycle and device behavior

Implement:

1. screen-off/user-present behavior
2. boot recovery
3. VPN watchdog
4. installer/uninstall interception
5. overlay lifecycle
6. launcher behavior
7. permission/settings flows

### Milestone 6: Cross-layer proof and reliability

Implement and run:

1. SharedPreferences and native-event boundary contract fixtures
2. React-to-Kotlin focus start/stop reconciliation
3. task edit/completion/deletion notification and native cleanup
4. process restart and stale-state recovery
5. failure injection and idempotency cases
6. repeat/stress runs for concurrency-sensitive paths
7. the documented full-validation command and test inventory

---

## 26. Definition of Done

The testing work is complete only when:

- every test has a runnable command
- fast tests are separated from Android/device tests
- tests are deterministic with controlled time and timezone
- every feature has both happy-path and failure-path coverage
- enforcement exemptions are tested as carefully as blocking behavior
- tests do not depend on the unavailable reference ZIP
- no production architecture was copied from another app
- no production abstraction was added solely to satisfy a copied test
- typecheck and the documented test commands pass
- any device-only coverage is listed honestly as device-only
- failures from unavailable native modules are represented as explicit
  unavailable states rather than mocked success
- tests are stored under the `artifacts/focusflow/` artifact boundary
- React-only, Kotlin-only, cross-layer, and device-only commands are separately
  identifiable
- at least one cross-layer contract suite exists, even if true device tests
  require a separate Android-capable environment
- the implementation includes a reproducible test inventory and records
  environment limitations instead of hiding them as skips
