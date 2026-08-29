---
name: Accessibility restricted-settings recovery
description: FocusFlow's post-attempt Android Accessibility recovery behavior.
---

FocusFlow should show restricted-settings help only after the user has tried
Accessibility setup and returned without granting it. If Android clears the
restricted-settings AppOp before the Accessibility service is enabled, keep the
recovery UI and its retry action visible until the service is actually granted.

**Why:** Android separates the “Allow restricted settings” unlock from enabling
the Accessibility service. Hiding the recovery UI immediately after the unlock
leaves the user without the next action.

**How to apply:** Keep onboarding's recovery state separate from the normal
permission status. Gate removal on Accessibility being granted, not only on the
restricted-settings AppOp becoming allowed. Keep the existing proactive banner
on the dedicated Permissions screen unchanged.