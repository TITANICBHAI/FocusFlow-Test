---
name: Onboarding permission tiers
description: Product decision for FocusFlow's first-run Android setup and permission gating.
---

FocusFlow's first-run setup keeps Usage Access, Accessibility Service, and Notifications as the only permissions counted for required readiness. Battery Optimization and Appear on Top remain in Core Setup as recommended, non-blocking access. Media & Files, VPN, Device Admin, and PIN protection belong in Optional Setup. Personalization is not part of first launch and remains available later from Settings.

**Why:** Android permission setup already feels demanding, and profile questions add fatigue before the user has experienced blocking. The app still needs to explain reliability-related access without preventing the user from reaching the product when only the true blocking prerequisites are ready.

**How to apply:** Preserve the distinction between the Core and Optional sections. Do not gate the Core continuation button on Battery Optimization or Appear on Top unless the product decision changes explicitly. Do not route first-run users through the profile questionnaire.