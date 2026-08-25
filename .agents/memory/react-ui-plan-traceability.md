---
name: React UI plan traceability
description: The imported FocusFlow UI master plan must remain the execution checklist for future implementation work.
---

The imported FocusFlow React UI plans are traceable at `artifacts/focusflow/react-ui plan.md` (primary) and `artifacts/focusflow/react-ui plan - companion.md` (related attachment), with the original sources retained at `attached_assets/master-plan_1787286671587.md` and `attached_assets/react_ui-plan_1787287243424.md`.

**Rule:** Every agent working on plan-covered implementation must open the traceability copy first, map its changes to phase/step IDs, tick completed items, and record evidence before handing work back. No agent may report a phase or the overall task complete while required items are unchecked, evidence is missing, or the relevant `tsc --noEmit` check has not passed. The final verification gate must be run again before declaring the plan complete.

**Why:** The plans span multiple UI phases with strict constraints and cross-file dependencies. The newer attachment also has formatting damage and apparent code-snippet typos, so a linked tracker prevents partial work and unvalidated copy/paste from being mistaken for completion.

**How to apply:** Before editing, open both trackers. Claim the relevant items, then after each phase record the same evidence and typecheck results in both. Validate the newer attachment against the primary source and current code. Before reporting completion, re-read both checklists, run the final checks, and resolve every unchecked item or explicitly mark it blocked with a reason.