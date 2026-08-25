---
name: FocusFlow additional recommendations
description: Optional FocusFlow reliability and product suggestions, with current implementation status kept in the artifact.
---

The additional recommendations are deliberately non-blocking: treat them as a prioritized backlog, not as requirements to implement immediately. The friction overlay and core PIN hashing coverage already exist; timed unlock, NFC triggering, unified permission health, precise allowance expiry, backup/session guarding, and VPN handoff proof remain candidates for later work.

**Why:** Some recommendations describe behavior already present in this checkout, while others require product decisions or real Android validation. Keeping status visible prevents duplicate work and avoids treating suggestions as confirmed defects.

**How to apply:** Consult `artifacts/focusflow/ADDITIONAL_RECOMMENDATIONS.md` for the tracked status and update that artifact when a suggestion is implemented or intentionally declined.