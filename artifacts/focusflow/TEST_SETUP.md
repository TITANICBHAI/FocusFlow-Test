# FocusFlow test setup

## Local installation workaround

The FocusFlow package uses Vitest for deterministic TypeScript unit and service
tests:

```sh
pnpm --filter @workspace/focusflow test
```

This workspace initially failed during dependency linking because the Replit
package firewall rejected the stale transitive tarball `shell-quote@1.8.3`.
The dependency came through `react-devtools-core`, which is part of the
existing Expo/React Native graph. The published `shell-quote` version was
checked before changing anything, and the workspace override was set to the
newer compatible `1.10.0`.

The next install attempt exposed a second stale transitive tarball,
`tar@7.5.13`. Its current published compatible version was checked, and the
workspace override was set to `7.5.22`.

The resulting recovery command was:

```sh
pnpm install --filter @workspace/focusflow --no-frozen-lockfile
pnpm --filter @workspace/focusflow test
```

These overrides are in the root `package.json` because pnpm applies workspace
dependency overrides there. Test files, configuration, and scripts remain
inside `artifacts/focusflow/`.

Do not bypass the package firewall or downgrade to an older tarball. If a
future install fails on another stale transitive package, check its dependency
path and published version first, then document the minimal compatible override
here.

## Verification status

- Vitest is linked and the FocusFlow test command runs normally.
- `pnpm --filter @workspace/focusflow test` passes 13 test files and 69 tests.
- TypeScript tests cover task lifecycle, scheduler behavior, password utilities,
  backup validation, persistence mirroring, focus orchestration, native event
  contracts, SharedPreferences contracts, diagnostic sanitization/email-draft
  behavior, notification scheduling/cancellation, headless background task
  handlers, blocked-app native process-flow contracts (broadcast, overlay,
  BACK/HOME dismissal, retry guards, and overlay Back navigation), and
  pure-JavaScript SHA-256 fallback vectors, including large-batch notification
  capacity, plus scheduler regressions for user-resolution conflicts, earlier-task
  preservation, zero/negative overruns, and non-early completion.
- The full FocusFlow typecheck currently reports unrelated existing errors in
  `app/changelog.tsx`, `app/onboarding.tsx`, `app/permissions.tsx`, and
  `src/context/AppContext.tsx`; those are not caused by the test setup.

## Test inventory

| Command | Layer | Proves | Result / limitation |
| --- | --- | --- | --- |
| `pnpm --filter @workspace/focusflow test` | JavaScript unit, service, and boundary contracts | Deterministic task/scheduler/PIN/backup/persistence behavior; focus lifecycle; headless overrun, fetch, and notification action handling; blocked-app native source contracts for broadcast, overlay, BACK/HOME dismissal, retry process guards, and overlay Back navigation; native payload serialization and event parsing; diagnostic and notification contracts | Passing locally; source-contract checks do not prove actual Android window/task/process behavior, overlays, VPN, launcher, or OEM behavior |
| `pnpm --filter @workspace/focusflow typecheck` | TypeScript static validation | Type correctness for application and test sources | Currently blocked by six pre-existing application errors in the four files listed above; no test-source errors remain |
| Android Gradle/JVM tests | Kotlin policy | Accessibility policy, allowance, UsageStats, and native parsing | Kotlin JVM policy source is present under `android-native/app/src/test` and is copied into generated Android projects; execution is unavailable here because no generated `android/` project, Gradle, Kotlin compiler, or Android SDK is present |
| Android instrumented/device tests | Android lifecycle/device | Overlay, AccessibilityService, notifications, VPN, launcher, permissions, and OEM-specific behavior | Not yet available; requires an Android-capable build/emulator/device environment |