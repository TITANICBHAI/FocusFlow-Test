---
name: Dependency installation timing
description: Project workflow preference for sequencing plan reading, code edits, dependency setup, and verification.
---

For plan-driven work, read the applicable tracking markdown first and make the requested code edits before installing dependencies. Dependency installation is lower priority and should happen when the user explicitly asks for setup, or when it is necessary to run the requested verification.

**Why:** Installing dependencies can be slow, mutate lockfiles, trigger workflow restarts, or fail on unrelated package-firewall issues before the requested implementation has started. The user wants control over that setup step rather than having it happen automatically.

**How to apply:** Do not install packages as the first action after opening a task. Inspect the plan and current code, implement the scoped changes, then ask before setup unless the user has already requested it. If verification needs dependencies, explain that dependency installation is required and request permission before doing it.