---
name: Android signing compatibility
description: Android Gradle Plugin signing-config property names used by the release build.
---

Modern Android Gradle Plugin runners expose v3 signing as `enableV3Signing`; `v3SigningEnabled` is not a valid signing-config method and fails during Gradle evaluation.

**Why:** The Indus release build reached Gradle only after dependency and prebuild failures were fixed, then stopped on the obsolete property name.

**How to apply:** When patching generated Expo Android signing configs, use the AGP-compatible `enableV3Signing` property and validate against the current runner’s AGP before reusing older workflow snippets.