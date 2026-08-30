---
name: Agent navigation feedback
description: Durable pointer to the FocusFlow navigation reliability request captured from attached feedback.
---

The FocusFlow artifact contains an attached navigation reliability request covering guarded route pushes, immediate loading feedback, deferred Active-screen loading, and one-frame sheet-open deferral. The original request and its implementation checklist are kept together in the artifact; the tracker is the status surface.

**Why:** This request spans multiple screens and shared navigation behavior, so keeping the source brief and a separate checklist prevents the implementation plan from becoming lost in chat history.

**How to apply:** Use `artifacts/focusflow/AGENT_NAV_FEEDBACK_1788057807906.md` as the detailed source and `artifacts/focusflow/AGENT_NAV_FEEDBACK_TRACKING.md` to update progress as each step is implemented.