---
name: Project context
description: Monorepo layout, what lives where, what runs in browser vs what needs EAS — enough to orient without reading any files.
---

## Stack
- Monorepo: pnpm workspaces, Node 24
- Mobile: Expo (React Native), Android-only, builds via EAS CLI
- Web packages: Vite + React
- No backend server anywhere in this repo

## Directory map

```
/                                  ← workspace root
├── artifacts/
│   ├── focusflow/                 ← MAIN APP — Expo Android (APK via EAS, NOT runnable in browser)
│   │   ├── app/                   ← expo-router screens (tabs, modals)
│   │   ├── src/
│   │   │   ├── context/           ← AppContext.tsx — global state
│   │   │   ├── services/          ← focusService.ts, backupService.ts, etc.
│   │   │   ├── components/        ← UI components
│   │   │   ├── native-modules/    ← JS bridge to Kotlin (SharedPrefsModule, etc.)
│   │   │   └── hooks/utils/i18n/
│   │   ├── android-native/        ← Kotlin source (services, receivers, widget)
│   │   │   └── app/src/main/java/com/tbtechs/focusflow/
│   │   │       ├── services/      ← ForegroundTaskService, AppBlockerAccessibilityService, etc.
│   │   │       ├── modules/       ← FocusDayPackage (RN native module bridge)
│   │   │       └── widget/        ← FocusFlowWidget
│   │   ├── plugins/
│   │   │   └── withFocusDayAndroid.js  ← single Expo config plugin; injects ALL manifest changes
│   │   ├── app.json               ← Expo config (permissions, EAS projectId, plugin list)
│   │   └── eas.json               ← EAS build profiles
│   │
│   ├── focusflow-ad/              ← Commercial ad video — Vite, port 3002, runs in browser
│   ├── mockup-sandbox/            ← UI prototyping canvas — Vite, port 5000, runs in browser
│   ├── focusflow-accessibility-demo/ ← A11y demo — Vite, port 3003, runs in browser
│   └── focusflow-feature-videos/  ← Feature video exports — Vite, port 6000, runs in browser
│
├── scripts/                       ← Utility scripts (GitHub push, EAS deploy, etc.)
├── lib/db/                        ← Drizzle ORM schema — unused, kept for future
├── docs/                          ← Static docs site (served with `npx serve`)
├── pnpm-workspace.yaml            ← Workspace package globs + catalog versions
└── plugins/withFocusDayAndroid.js ← (same file as artifacts/focusflow/plugins/ — the config plugin)
```

## What runs where
| Package | Runs in browser? | How |
|---|---|---|
| `artifacts/focusflow` | ❌ No | EAS build → APK |
| `artifacts/focusflow-ad` | ✅ Yes | `pnpm --filter @workspace/focusflow-ad run dev` |
| `artifacts/mockup-sandbox` | ✅ Yes | `pnpm --filter @workspace/mockup-sandbox run dev` |
| `artifacts/focusflow-accessibility-demo` | ✅ Yes | `pnpm --filter @workspace/focusflow-accessibility-demo run dev` |
| `artifacts/focusflow-feature-videos` | ✅ Yes | `pnpm --filter @workspace/focusflow-feature-videos run dev` |

## Key config plugin rule
ALL AndroidManifest changes go through `artifacts/focusflow/plugins/withFocusDayAndroid.js`. Never edit a generated `android/` file directly — it gets overwritten on every `expo prebuild`. Security flags (`allowBackup`, `usesCleartextTraffic`, etc.) must be set **unconditionally** (direct assignment, not guarded by `if (!existing)`).

## App package name
`com.tbtechs.focusflow` — used in Kotlin, manifest, and EAS.
