---
name: Imported audit verification
description: How to handle uploaded codebase reviews that may lag behind the current checkout
---

Treat uploaded codebase audits as a checklist of claims, not as the current source of truth. Re-check every cited function and subsystem in the working tree before changing code; imported projects often contain partial fixes made after the audit was written.

**Why:** The schedule audit used for this review described ten issues that were already fixed in the current checkout, so applying them blindly would have duplicated or regressed existing behavior.

**How to apply:** Map each finding to the current implementation first, report the already-fixed items separately, and patch only the findings that still reproduce in the current source.