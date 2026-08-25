---
name: FocusFlow test planning
description: Durable constraints for testing the FocusFlow mobile artifact across JavaScript, Kotlin, Android, contract, CI, and security evidence layers.
---

FocusFlow testing is feature-led and architecture-led. Keep all FocusFlow test code, fixtures, configuration, and test scripts inside `artifacts/focusflow/`; native test source belongs under the durable FocusFlow native boundary. Do not place these tests in the mockup sandbox, FocusFlow-pc, or shared unrelated test directories.

Treat React/TypeScript unit tests, React service/orchestration tests, Kotlin policy/JVM tests, Android/Robolectric tests, React↔Kotlin boundary contract tests, and real Android emulator/device tests as separate evidence layers. Passing mocks do not prove Kotlin enforcement or Android lifecycle behavior. Contract coverage must verify the actual shared keys, payloads, identifiers, timestamps, package names, enabled states, durations, native events, malformed/missing data, and unavailable-native states.

Generated Android output must not be the only durable home for native tests. Before choosing a Kotlin test location, inspect Expo prebuild and `android-native/install.sh`; if prebuild regenerates the project, install durable native tests through the established native integration path.

Use deterministic tests with fixed clocks/timezones, isolated persistence, seeded inputs, failure injection, idempotency checks, and repeated concurrency coverage. A failed native operation must never be represented as successful enforcement.

Run evidence in this order: Replit-local typecheck and JavaScript tests; locally runnable Kotlin JVM/Robolectric tests; grouped GitHub Actions validation; emulator/device tests; then relevant FocusFlow-only GitHub CodeQL review. Use one grouped FocusFlow workflow with JavaScript/contracts, Android JVM/Robolectric, and optional device jobs rather than one workflow per feature or test file. Keep Replit workflows for app serving and previewing.

Review only CodeQL findings relevant to the current `artifacts/focusflow/` mobile artifact, and add regression tests only when a finding has a real behavioral contract. Use approved workspace integration or secret mechanisms for GitHub access; never place credentials in memory, source, fixtures, logs, reports, or chat.

**Why:** FocusFlow combines React state, SQLite, SharedPreferences, Android services, accessibility enforcement, notifications, alarms, and device-only behavior. Separate evidence layers and durable native sources prevent false confidence and lost tests after regeneration.

**How to apply:** Read `artifacts/focusflow/FOCUSFLOW_TEST_PLAN.md` for feature-level coverage and repository commands. Keep implementation details, inventories, test counts, transient CI results, and device data in the plan/repository outputs rather than project memory.

Local dependency installation may require workspace-level pnpm overrides for blocked stale transitive tarballs. Prefer the latest published compatible version and document each override in `artifacts/focusflow/TEST_SETUP.md`; do not bypass the package firewall or replace the Expo/React Native stack.

**Why:** The Replit package firewall can reject an older transitive tarball before pnpm creates workspace links, even when the dependency graph is otherwise valid.

**How to apply:** When installation fails with a firewall 403, inspect the dependency path and published versions, add only a root pnpm override for a newer compatible transitive package, reinstall with the FocusFlow filter, and verify the normal package script.