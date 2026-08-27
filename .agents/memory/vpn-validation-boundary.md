---
name: VPN validation boundary
description: What can be verified in the current FocusFlow checkout versus what needs generated Android artifacts and a device.
---

Source-level VPN recovery contracts and TypeScript checks are available after installing the FocusFlow workspace dependencies, but this checkout does not contain a generated Android Gradle project or Kotlin/Android toolchain.

**Why:** A passing source contract suite cannot prove Android service lifecycle, VPN permission recovery, per-app routing, or packet behavior.

**How to apply:** Treat contract tests and shell/diff checks as preflight evidence only; keep Phase 5 open until a generated Android build is compiled and exercised on a real Android device or emulator.