---
name: Android SQLite write serialization
description: Concurrency constraint for Expo SQLite mutations on Android
---

All application database mutations must pass through one serialized write queue; single-flight database opening only prevents duplicate opens and does not prevent concurrent writes from contending on the same native SQLite handle.

**Why:** Large bursts of task inserts or schedule updates can surface `SQLITE_BUSY` / database-locked failures even when the database singleton and open recovery are correct.

**How to apply:** Keep reads independently callable, but route inserts, updates, deletes, transactions, settings writes, session writes, checkpoints, and pruning through the shared mutation queue. A short SQLite busy timeout is a secondary safeguard, not a replacement for serialization.