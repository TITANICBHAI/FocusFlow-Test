# FocusFlow Agent Memory

## Token efficiency rules (apply every turn)
- **grep/rg before reading** — locate the exact file + line range first, then read only that range. Never read a whole file when a search would do.
- **Batch all independent tool calls** — if two reads/edits/searches don't depend on each other, fire them in one response block.
- **No subagents** — user preference: work directly, no explore or delegation subagents.
- **No full-file reads** — use `start_line`/`end_line`. If a file is large, search it first.
- **No speculative reads** — only read a file when you have a concrete reason. Don't pre-read "just in case".
- **Prefer ShellExec grep over ReadFile** for finding where something is defined or called.

## User preferences
- No subagents (explore or otherwise) — work directly.
- Ask before major architectural changes or new external dependencies.
- Iterative development with clear communication at each stage.

## Import guard
When assigned "Set up the imported project" (or any import/onboarding task):
- Do NOT run `pnpm install`, start workflows, or attempt to run/preview anything.
- Skim `Readme.md` first 30 lines + glance at `artifacts/` listing, then ask user what they want via AskQuestion.
- Android app (`artifacts/focusflow`) = EAS build → APK. Cannot run in browser. No browser preview exists.
- Web packages (mockup-sandbox, focusflow-ad, feature-videos) CAN run in browser but ask first.

## Project layout

```
/
├── artifacts/
│   ├── focusflow/                 ← MAIN APP — Expo Android, APK via EAS, NOT browser-runnable
│   │   ├── app/                   ← expo-router screens (tabs, modals)
│   │   ├── src/
│   │   │   ├── context/AppContext.tsx   ← global state, init(), all save paths
│   │   │   ├── native-modules/         ← JS↔Kotlin bridge (SharedPrefsModule.ts, etc.)
│   │   │   ├── components/             ← UI components (modals, cards)
│   │   │   └── services/ hooks/ utils/ i18n/
│   │   ├── android-native/app/src/main/java/com/tbtechs/focusflow/
│   │   │   ├── modules/           ← SharedPrefsModule.kt + other RN native modules
│   │   │   ├── services/          ← AppBlockerAccessibilityService.kt, ForegroundTaskService.kt
│   │   │   └── widget/            ← FocusFlowWidget
│   │   ├── plugins/withFocusDayAndroid.js  ← ALL AndroidManifest changes go here (never edit generated android/ directly)
│   │   ├── app.json               ← Expo config (permissions, EAS projectId)
│   │   └── eas.json               ← EAS build profiles
│   ├── focusflow-ad/              ← Ad video — Vite, port 3002
│   ├── mockup-sandbox/            ← UI canvas — Vite, port 5000
│   ├── focusflow-accessibility-demo/ ← A11y demo — Vite, port 3003
│   └── focusflow-feature-videos/  ← Feature videos — Vite, port 6000
├── scripts/                       ← GitHub push, EAS deploy scripts
├── docs/                          ← Static docs (npx serve, port 3000)
└── pnpm-workspace.yaml
```

**App package name:** `com.tbtechs.focusflow`
**Stack:** pnpm monorepo, Node 24, Expo (RN) for mobile, Vite+React for web packages.

## What runs where
| Package | Browser? | Command |
|---|---|---|
| `artifacts/focusflow` | ❌ EAS only | `eas build` |
| `artifacts/focusflow-ad` | ✅ | `pnpm --filter @workspace/focusflow-ad run dev` |
| `artifacts/mockup-sandbox` | ✅ | `pnpm --filter @workspace/mockup-sandbox run dev` |
| `artifacts/focusflow-accessibility-demo` | ✅ | `pnpm --filter @workspace/focusflow-accessibility-demo run dev` |
| `artifacts/focusflow-feature-videos` | ✅ | `pnpm --filter @workspace/focusflow-feature-videos run dev` |

## Architecture: SP-primary enforcement (implemented)
Group A fields (Kotlin-critical) are now SharedPreferences-primary:
- **On save:** SP written first, DB written as backup (all existing save paths already did this).
- **On cold start:** `SharedPrefsModule.getAllEnforcementSettings()` reads all Group A keys in one bridge call → dispatched immediately → DB loads async → merged on top (DB wins on success; SP wins over defaults on timeout).
- **Group A keys:** standaloneBlockPackages, standaloneBlockUntil, alwaysOnPackages/EnforcementEnabled, dailyAllowanceEntries, blockedWords, systemGuardEnabled, blockInstallActionsEnabled, blockYoutubeShortsEnabled, blockInstagramReelsEnabled, vpnBlockEnabled, standaloneVpnPackages, launcherBlockUninstall, launcherLockDuringStandalone, launcherHiddenPackages, launcherDockPackages, launcherClockStyle.
- **Group C (DB-only):** darkMode, pomodoroSettings, notificationsEnabled, onboardingComplete, privacyAccepted, userProfile, language, tipsCardDismissed, achievement states, etc.

## One-time flag SP backup (already wired)
- `privacyAccepted` → SP key `privacy_accepted` written in `app/privacy-policy.tsx:152` after `updateSettings` succeeds.
- `onboardingComplete` → SP key `onboarding_complete` written in `app/user-profile.tsx` in all 3 paths: main save (:253), skip (:294), import-from-backup (:324).
- `init()` cross-checks both keys if DB returns false for either — restores and re-saves to DB.

## Config plugin rule
ALL AndroidManifest.xml changes go through `artifacts/focusflow/plugins/withFocusDayAndroid.js`. Never edit a generated `android/` file directly — overwritten on every `expo prebuild`. Security flags must be set unconditionally (direct assignment, not guarded by `if (!existing)`).
