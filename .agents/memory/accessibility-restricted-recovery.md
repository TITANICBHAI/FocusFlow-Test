---
name: Accessibility restricted-settings recovery
description: FocusFlow's post-attempt Android Accessibility recovery behavior.
---

FocusFlow should show the Accessibility recovery helper only after the user has
tried Accessibility setup and returned without granting it. Ask whether they
tapped the greyed-out entry, offer a skip path, and only show App Info/restricted
settings instructions after confirmation or the guided greyed-entry step.
After unlocking restricted settings, keep the final Accessibility retry visible
until the service is actually granted.

**Why:** Android separates the “Allow restricted settings” unlock from enabling
the Accessibility service, and the app cannot reliably observe whether a user
tapped the greyed-out system row. A branching, user-confirmed guide handles
both OEM flows without trapping users who want to skip Accessibility.

**How to apply:** Keep onboarding's recovery state separate from the normal
permission status. Let “No, I haven’t tapped it” deep-link to Accessibility,
let “Yes” go directly to App Info guidance, and keep the greyed-entry fallback
collapsible within the App Info step. Gate removal on Accessibility being
granted, not only on the restricted-settings AppOp becoming allowed. Keep the
existing proactive banner on the dedicated Permissions screen unchanged.