---
name: FocusFlow Gradle flavours
description: Durable rules for recreating the FocusFlow Play and Indus Android flavour release method.
---

The complete repeatable procedure is documented in `artifacts/focusflow/gradle flavour.md`. The durable rules are:

- Keep the configured Expo package as `com.tbtechs.focusflow`.
- Define the alternate Indus ID through a Gradle variable; Expo can rewrite literal application-ID assignments during clean prebuild.
- Keep equivalent flavour insertion logic in both the Expo config plugin and the manual native installer.
- Use explicit `playDebug`, `playRelease`, and `indusRelease` Gradle tasks and flavour-specific output paths.
- Use `enableV3Signing`, not `v3SigningEnabled`, with current Android Gradle Plugin signing configs.
- Build APKs with splits as needed, then disable ABI/density splits before the AAB task.
- Use frozen pnpm installation in CI and regenerate the lockfile whenever package dependency sections change.
- Run cleanup from the repository root with a guarded keystore path because `android/app` may not exist after an earlier prebuild failure.

**Why:** The flavour implementation had to survive clean Expo regeneration and then pass a real hosted Android release build; each of the rules above corresponds to a failure boundary or a required build invariant.

**How to apply:** Read the artifact guide before recreating the flavour or release workflow, then verify generated `android/app/build.gradle`, explicit Gradle tasks, output paths, and both release assets.