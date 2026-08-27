---
name: VPN enforcement plan authority
description: Authority and mandatory reading order for FocusFlow VPN background enforcement planning.
---

`artifacts/focusflow/VPN_BACKGROUND_ENFORCEMENT_PLAN.md` is the primary plan for VPN background enforcement. `artifacts/focusflow/VPN_PLAN_CODE_REVIEW_1787795464198.md` is its supporting, code-verified review. Both documents are mandatory reading before implementing this feature; resolve conflicts in favor of the primary plan while using the review to validate claims and identify code-specific gaps.

VPN protection is an independent enforcement layer. Android per-app VPN routing operates at the package UID level, so a package registered in the target set loses both foreground and background network access; the VPN itself should not detect foreground/background state. A package may be selected for VPN blocking without being selected for an overlay block, and a configured VPN package list must activate and remain health-monitored even when no ordinary focus or standalone block session is active.

For the proposed background-enforcement feature, keep explicit VPN selections separate from Accessibility focus rules and add focus-disallowed packages only through an opt-in native policy coordinator. Use `PER_APP` mode, stop on an empty target set, preserve visible permission/conflict/failure states, and do not copy implementation code from the GPL-3.0 Silent Guardian reference.

**Why:** The feature plan defines the intended product and architecture, while the code review adds source-verified confirmation and gaps. Reading only one can cause either implementation drift or missed current-code constraints.

**How to apply:** Before implementation, read both VPN documents. Treat the VPN target set as native durable policy, merge supported sources, reconfigure only when the effective set changes, restore it after lifecycle events, and preserve the AccessibilityService overlay pipeline separately. Use Silent Guardian only for independent architectural comparison; its GPL license makes source copying unsafe without a deliberate legal review.

Recovery commands must recalculate from persisted policy sources at dispatch time and carry the desired-policy generation; `net_block_packages` is a compatibility/cache snapshot, not authoritative recovery input.

**Why:** Delayed revoke recovery and reordered service commands can otherwise restore an expired or superseded target set after the user has already changed policy.

**How to apply:** Re-read policy after teardown delays, reject older queued commands, clear the canonical snapshot when the effective set becomes empty, and keep overlay-only state out of VPN recovery gates.