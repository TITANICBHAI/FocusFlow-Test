---
name: Workspace package firewall
description: Environment-specific limitation encountered while installing the FocusFlow workspace dependencies.
---

A filtered, frozen pnpm install can still fail before linking workspace-local dependencies when the package firewall rejects the shared `shell-quote@1.8.3` tarball with HTTP 403.

**Why:** The failure prevents the workspace `tsc` binary and React Native/Expo type packages from becoming available, so a typecheck may show broad missing-module and standard-library errors that do not identify application-code defects.

**How to apply:** Preserve the existing package manifest and lockfile when setup is not the requested work. If installation is authorized, a failed filtered add may update only the lockfile before the firewall stops linking; verify both manifest and lockfile, record the failure precisely, and do not mark a phase typecheck as passing unless the normal workspace command completes successfully.