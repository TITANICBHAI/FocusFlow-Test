---
name: Task deletion and focus cleanup
description: The safety boundary for deleting all scheduled tasks while focus enforcement may be active.
---

Clearing all tasks must stop any active focus session and close its database session record before deleting task rows; standalone and Defense block settings remain untouched.

**Why:** A task row can be deleted while native focus enforcement or an active focus-session record still exists, creating an orphaned protected session.

**How to apply:** Require the configured Focus Session Password before stopping an active session, perform idempotent session cleanup, then cancel reminders and delete only task data.