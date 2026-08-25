---
name: System-control enforcement gate
description: Native FocusFlow rules for separating system-control protection from app-list blocking.
---

Installer/package-manager interception is a system-control feature and must be gated by the explicit Protect system controls preference; Focus, Standalone, and Always-On app lists alone must not block package installation.

**Why:** App-list enforcement can be active independently, and coupling it to installer interception prevents legitimate package installs even when the user did not enable system protection.

**How to apply:** When adding or reviewing native blocking paths, verify both the explicit system-control toggle and any session/Always-On conditions where the feature requires them. Keep delayed retries subject to the same live toggle.