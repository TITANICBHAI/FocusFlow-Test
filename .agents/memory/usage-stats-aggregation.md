---
name: Android usage aggregation
description: Precision and interpretation rules for the Android UsageStats reports.
---

Aggregate UsageStats `totalTimeInForeground` values in milliseconds across all returned buckets before converting to whole display minutes. Do not floor each bucket first.

**Why:** Daily/package bucket flooring can discard nearly a minute per bucket and make short real usage disappear. Android foreground time is also an observed-foreground metric, not an identical replacement for Screen Time or recorded FocusFlow session time.

**How to apply:** Keep raw millisecond aggregation in the native module, label the UI as observed device time, and keep product decisions about Android’s finite history window separate from all-time FocusFlow database totals.