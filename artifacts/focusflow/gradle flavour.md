# FocusFlow Gradle Flavour and Indus Appstore Release Guide

This document records the complete Gradle product-flavour implementation and
release-build method that was introduced in the three workspace-sync commits
after commit `62d389004f441454c77a910fb5d491bb80524a63`.

The three commits were later reverted from `main` with an aggregate revert so
the repository history stayed intact. The implementation itself was proven by
the successful GitHub Actions run for the `indus-v1.1.0` tag. This guide
preserves the method so it can be recreated deliberately in a future change
instead of relying on the removed commits.

## 1. What the flavour setup solves

FocusFlow needs one Android codebase to produce installable builds for two
distribution channels:

| Store / channel | Gradle flavour | Android `applicationId` | Intended output |
|---|---|---|---|
| Google Play and the normal GitHub release | `play` | `com.tbtechs.focusflow` | Play debug APK, Play release APKs, Play AAB |
| Indus Appstore | `indus` | `com.tbtechsdev.focusflow` | Indus release APK and Indus release AAB |

The two flavours share:

- The same Expo/React Native JavaScript application.
- The same Kotlin modules, services, receivers, activities, and resources.
- The same Android namespace and native source package:
  `com.tbtechs.focusflow`.
- The same signing keystore and signing credentials, supplied only through
  GitHub Actions secrets.
- The same R8/ProGuard configuration.

They differ only in the application identity used by Android. Keeping the
Indus `applicationId` different prevents the Indus build from being treated as
the same installed application as the Google Play build.

This is an Android Gradle product-flavour change, not a second Expo app and not
a copy of the Kotlin source tree.

## 2. Historical change set

### 2.1 First sync commit: `c9d134993e84c3d647f8ade9b246a39cc56895eb`

Parent: `62d389004f441454c77a910fb5d491bb80524a63`

This was the main implementation commit. Its GitHub statistics were 405 total
line changes, with 370 additions and 35 deletions. It changed 12 tracked
files:

1. Added the memory note explaining the Expo application-ID workaround.
2. Changed debug builds to use the explicit `play` flavour.
3. Changed normal release builds to use the explicit `play` flavour.
4. Changed debug-tag builds to use the explicit `play` flavour.
5. Added the complete Indus tag release workflow.
6. Renamed and redirected the normal tag release workflow to Play outputs.
7. Temporarily added Python and Java modules to `.replit`.
8. Added a flavour block to the manual native installer.
9. Added explicit Play Gradle commands to `eas.json`.
10. Added Android run scripts and explicit Expo/React Native runtime
    dependencies to `package.json`.
11. Added the flavour block to the Expo config plugin.
12. Added the memory topic describing why alternate application IDs must use a
    Gradle variable.

The first commit intentionally changed all build entry points, not only the
new Indus workflow. Without that, the default `assembleDebug`,
`assembleRelease`, or `bundleRelease` tasks would become ambiguous once the
`store` flavour dimension existed.

### 2.2 Second sync commit: `e42b2cd2594b8c4af032ce38789128c7c898efef`

Parent: `c9d134993e84c3d647f8ade9b246a39cc56895eb`

This was the build-reliability repair commit. It changed three files:

- `.github/workflows/release-indus-tag.yml`
- `.replit`
- `pnpm-lock.yaml`

The changes were:

1. The cleanup step stopped assuming that Expo had generated
   `artifacts/focusflow/android/app`.
2. The extra Python and Java Replit modules were removed again because they
   were not needed by the normal workspace workflow.
3. The pnpm importer was regenerated to match the actual FocusFlow
   `package.json`.
4. `expo`, `react`, and `react-native` were represented in the correct
   dependency section of the lockfile.
5. Stale duplicate importer entries were removed.
6. pnpm snapshot metadata and peer references were normalized.

This commit is what allowed the GitHub runner to pass
`pnpm install --frozen-lockfile`.

### 2.3 Third sync commit: `ce94036b28994b1e604c26bd2fa6dfce97984102`

Parent: `e42b2cd2594b8c4af032ce38789128c7c898efef`

This was a one-line Android Gradle compatibility repair:

```groovy
- v3SigningEnabled true
+ enableV3Signing true
```

The GitHub runner's Android Gradle Plugin exposed `enableV3Signing` on the
signing configuration. `v3SigningEnabled` was rejected as an unknown Gradle
method during evaluation. The older spelling must not be restored.

## 3. The important Expo application-ID rule

The configured/default Android package remains:

```json
{
  "expo": {
    "android": {
      "package": "com.tbtechs.focusflow"
    }
  }
}
```

The alternate Indus ID must not be added as a literal `applicationId` value
inside a config-plugin-generated flavour block.

### Correct pattern

```groovy
def focusFlowIndusApplicationId = "com.tbtechsdev.focusflow"

productFlavors {
    play {
        dimension "store"
        applicationId "com.tbtechs.focusflow"
    }
    indus {
        dimension "store"
        applicationId focusFlowIndusApplicationId
    }
}
```

### Why the variable is required

Expo's Android package modifier searches generated Gradle content for literal
`applicationId "..."` or `applicationId '...'` assignments and can rewrite
those literals to the configured `expo.android.package`. That behavior also
affects a literal alternate ID inserted by a config plugin.

If the Indus line is written directly as:

```groovy
applicationId "com.tbtechsdev.focusflow"
```

Expo can rewrite it during `expo prebuild --clean`, causing both flavours to
receive `com.tbtechs.focusflow`. The build may still compile, but the Indus
artifact will have the wrong Android identity.

Using a local Gradle variable keeps the alternate value out of the literal
package-assignment pattern that Expo rewrites:

```groovy
def focusFlowIndusApplicationId = "com.tbtechsdev.focusflow"
applicationId focusFlowIndusApplicationId
```

Always inspect the generated `android/app/build.gradle` after a clean
prebuild. Do not verify only the source plugin.

## 4. Where the flavour configuration belongs

There are two native-generation paths and both need the same flavour logic.

### 4.1 `plugins/withFocusDayAndroid.js` is the release-source-of-truth

The Expo config plugin runs automatically during:

```bash
npx expo prebuild --platform android --clean --no-install
```

The plugin's `withFocusDayBuildConfig` dangerous modifier:

1. Resolves the generated project root from `cfg.modRequest.platformProjectRoot`.
2. Opens `android/app/build.gradle`.
3. Returns without changing anything if that file does not exist.
4. Checks for `com.tbtechsdev.focusflow` before inserting the block.
5. Inserts the flavour block immediately before the first `buildTypes` block.
6. Uses the `store` flavour dimension.
7. Defines the Indus ID in a local Gradle variable.
8. Leaves the Kotlin package unchanged.
9. Logs that Play and Indus flavours were added.
10. Writes the generated Gradle file back to disk.

The insertion guard is important. A config plugin may be called more than once
in a development process, and repeated insertion would create duplicate
flavour dimensions or duplicate flavour names.

The generated block is:

```groovy
// FocusFlow store variants
flavorDimensions "store"
def focusFlowIndusApplicationId = "com.tbtechsdev.focusflow"
productFlavors {
    play {
        dimension "store"
        applicationId "com.tbtechs.focusflow"
    }
    indus {
        dimension "store"
        applicationId focusFlowIndusApplicationId
    }
}
```

The plugin must retain this logic even if `android/` is present locally. A
clean prebuild deletes and regenerates `android/`; a manually edited generated
project is not durable.

### 4.2 `android-native/install.sh` is the manual/native fallback

The installer runs after a normal Expo prebuild:

```bash
npx expo prebuild --platform android
chmod +x android-native/install.sh
./android-native/install.sh
```

It keeps a second copy of the flavour insertion because it is also used for
manual native installation and local workflows that do not rely exclusively on
the config plugin.

The installer:

1. Computes `APP_GRADLE="$ANDROID_DIR/app/build.gradle"`.
2. Checks that the generated Android project and manifest exist.
3. Checks whether the Gradle file already contains
   `com.tbtechsdev.focusflow`.
4. Uses a small Python regular-expression replacement to insert the same
   `store` dimension and `play`/`indus` flavour block before `buildTypes`.
5. Fails explicitly if the expected `buildTypes` block cannot be found.
6. Prints that the flavours were added or were already present.

The installer and plugin deliberately share the same values:

| Item | Value |
|---|---|
| Dimension | `store` |
| Play flavour | `play` |
| Indus flavour | `indus` |
| Play ID | `com.tbtechs.focusflow` |
| Indus ID | `com.tbtechsdev.focusflow` |

Do not change one implementation without changing the other. The config
plugin protects clean Expo prebuilds; the installer protects manual native
regeneration.

## 5. Gradle variant matrix

Adding one `store` dimension creates variant names by combining each store
flavour with each build type.

The variants used by this project are:

| Variant | Purpose | Gradle task |
|---|---|---|
| `playDebug` | Google Play-style development/debug APK | `assemblePlayDebug` |
| `playRelease` | Signed Google Play APK/AAB | `assemblePlayRelease`, `bundlePlayRelease` |
| `indusRelease` | Signed Indus APK/AAB | `assembleIndusRelease`, `bundleIndusRelease` |

The old unqualified tasks are no longer the right release entry points:

```text
assembleDebug       -> do not use for this flavour setup
assembleRelease     -> do not use for this flavour setup
bundleRelease       -> do not use for this flavour setup
```

Use the fully-qualified flavour tasks. This avoids Gradle selecting an
unexpected variant and makes output directories deterministic.

## 6. Changes to each build entry point

### 6.1 Debug artifact workflow

The debug workflow changed:

```bash
./gradlew assembleDebug
```

to:

```bash
./gradlew assemblePlayDebug
```

The output search changed from:

```text
artifacts/focusflow/android/app/build/outputs/apk/debug/
```

to:

```text
artifacts/focusflow/android/app/build/outputs/apk/play/debug/
```

The artifact upload path follows the same `apk/play/debug` directory.

This workflow intentionally produces the Play debug variant. Indus does not
need a separate debug workflow merely because it has a separate release
identity.

### 6.2 Debug tag workflow

The debug-tag workflow changed:

```bash
./gradlew assembleDebug --no-daemon --stacktrace
```

to:

```bash
./gradlew assemblePlayDebug --no-daemon --stacktrace
```

The verification path changed from:

```text
artifacts/focusflow/android/app/build/outputs/apk/debug/app-debug.apk
```

to:

```text
artifacts/focusflow/android/app/build/outputs/apk/play/debug/app-play-debug.apk
```

The release-copy step uses the same Play debug APK and then publishes the
debug-tag release as before.

### 6.3 Normal Play release workflow

The normal release workflow remains the Google Play/GitHub release path. Its
names and paths were made explicit:

```bash
./gradlew assemblePlayRelease --no-daemon
./gradlew bundlePlayRelease --no-daemon
```

APK output paths use:

```text
artifacts/focusflow/android/app/build/outputs/apk/play/release/
```

The expected Play APK names include:

```text
app-play-arm64-v8a-release.apk
app-play-armeabi-v7a-release.apk
app-play-universal-release.apk
```

The AAB output path is:

```text
artifacts/focusflow/android/app/build/outputs/bundle/playRelease/app-play-release.aab
```

Before the AAB build, ABI splits are disabled. The APK build retains splits so
the Play release can produce architecture-specific APKs plus a universal
fallback. The AAB is built with splits disabled because a Play AAB should be a
single bundle from which Play can deliver the correct configuration.

The workflow's user-facing job and step names explicitly say `Play` so a
future maintainer does not confuse the normal release with the Indus release.

### 6.4 Indus release workflow

The dedicated file is:

```text
.github/workflows/release-indus-tag.yml
```

It runs only for tags matching:

```yaml
on:
  push:
    tags:
      - 'indus-v*'
```

This namespace is intentionally separate from normal `v*` release tags.

The workflow grants:

```yaml
permissions:
  contents: write
```

That permission is required for `softprops/action-gh-release` to create or
update the GitHub Release and upload the APK/AAB assets.

The workflow environment sets:

```yaml
env:
  NPM_CONFIG_NODE_LINKER: hoisted
  EXPO_ROUTER_APP_ROOT: app
```

These values must be present during dependency installation, Expo prebuild,
and the Gradle-oriented release process.

## 7. Complete Indus workflow sequence

The successful Indus build used the following order. Keep this order when
recreating the workflow.

### Step 1: Check out the tag

Use `actions/checkout@v4`. The checked-out revision must be the
`indus-v*` tag that triggered the run.

### Step 2: Install Java 17

Use `actions/setup-java@v4` with:

```yaml
java-version: '17'
distribution: 'temurin'
```

The Android Gradle build is expected to run with Java 17.

### Step 3: Install Node.js 20

Use `actions/setup-node@v4` with:

```yaml
node-version: '20'
```

The runner may emit a warning that actions internally target an older Node
runtime. That warning is not the Gradle build failure. Do not treat the
deprecation warning as a reason to change the Android variant logic.

### Step 4: Install pnpm 9

Use `pnpm/action-setup@v4`:

```yaml
version: 9
```

The workflow and lockfile must be compatible with the selected pnpm major.

### Step 5: Cache dependencies

Cache:

- The pnpm store, keyed from `pnpm-lock.yaml`.
- Gradle caches and the Gradle wrapper, keyed from
  `gradle-wrapper.properties`.

Caching is an optimization only. A cache hit must not replace the frozen
lockfile install.

### Step 6: Install JavaScript dependencies

Use:

```bash
pnpm install --frozen-lockfile
```

Do not silently change this to `--no-frozen-lockfile` in CI. A frozen install
is what proves that `package.json` and `pnpm-lock.yaml` agree.

If this step fails with `ERR_PNPM_OUTDATED_LOCKFILE`, update the lockfile from
the actual package files before pushing:

```bash
pnpm install --lockfile-only --no-frozen-lockfile --ignore-scripts
pnpm install --frozen-lockfile --lockfile-only --ignore-scripts
```

Do not hand-edit only one importer line if pnpm also needs to normalize
snapshot peer references.

### Step 7: Read the app version

From `artifacts/focusflow/app.json`, read:

- `expo.version`
- `expo.android.versionCode`

Write both values to `$GITHUB_OUTPUT` and to `$GITHUB_STEP_SUMMARY`.

Also record the Indus package ID in the summary:

```text
com.tbtechsdev.focusflow
```

The build artifact version and the tag are separate values. The tag is
available as `${{ github.ref_name }}`.

### Step 8: Run clean Expo prebuild

From `artifacts/focusflow`, run:

```bash
npx expo prebuild --platform android --clean --no-install
```

The `--clean` flag is important because it proves that the config plugin
recreates the Android project rather than depending on a previously generated
or manually modified `android/` directory.

The `--no-install` flag keeps dependency installation controlled by the
workflow's explicit frozen pnpm step.

### Step 9: Copy ProGuard rules

From `artifacts/focusflow`, copy the project rules into the generated Android
app when the source file exists:

```bash
if [ -f proguard-rules.pro ]; then
  cp proguard-rules.pro android/app/proguard-rules.pro
fi
```

This keeps custom FocusFlow native classes and services available after R8.

### Step 10: Enable R8 full mode

Append the following to generated `android/gradle.properties`:

```properties
android.enableR8.fullMode=true
```

The append operation is deliberately after prebuild because prebuild
regenerates the Android project.

### Step 11: Patch the signing configuration

The Indus workflow opens generated `app/build.gradle`, removes any existing
`signingConfigs` block, and inserts a release signing configuration before
`buildTypes`.

The credentials are read from environment variables:

```groovy
signingConfigs {
    release {
        storeFile file("release.keystore")
        storePassword (System.getenv("RELEASE_STORE_PASSWORD") ?: "")
        keyAlias     (System.getenv("RELEASE_KEY_ALIAS")        ?: "")
        keyPassword  (System.getenv("RELEASE_KEY_PASSWORD")     ?: "")
        v1SigningEnabled true
        v2SigningEnabled true
        enableV3Signing true
    }
}
```

The exact compatibility rule is:

- `v1SigningEnabled true` is valid in the runner used by the successful build.
- `v2SigningEnabled true` is valid in that runner.
- `enableV3Signing true` is the valid v3 property.
- `v3SigningEnabled true` fails with
  `Could not find method v3SigningEnabled()`.

The release build type is then patched to reference:

```groovy
signingConfig signingConfigs.release
```

Never put a keystore, password, alias, or password value directly in the
repository. Only the file path and environment-variable names belong in
Gradle source.

### Step 12: Decode the release keystore

The workflow writes the base64-encoded GitHub secret to:

```text
artifacts/focusflow/android/app/release.keystore
```

This file exists only on the ephemeral runner. The four required secrets are:

```text
RELEASE_KEYSTORE_BASE64
RELEASE_STORE_PASSWORD
RELEASE_KEY_ALIAS
RELEASE_KEY_PASSWORD
```

Never commit the decoded file and never print secret values.

### Step 13: Build the Indus APK

From `artifacts/focusflow/android`, run:

```bash
./gradlew assembleIndusRelease --no-daemon
```

The flavour-specific output directory is:

```text
artifacts/focusflow/android/app/build/outputs/apk/indus/release/
```

The universal APK expected by the workflow is:

```text
app-indus-universal-release.apk
```

The workflow publishes the universal APK because it is the simplest direct
Indus Appstore upload and direct-install artifact.

### Step 14: Disable ABI splits before the Indus AAB

The APK build keeps the ABI split configuration. Before the AAB build:

1. Attempt to disable `enable true` inside the Gradle `splits` block.
2. Append:

```properties
android.splits.abi.enable=false
android.splits.density.enable=false
```

The `sed` operation is allowed to find no matching block because the Gradle
properties are the durable fallback. The command itself is guarded with
`|| true`; the actual AAB build remains strict.

### Step 15: Build the Indus AAB

From `artifacts/focusflow/android`, run:

```bash
./gradlew bundleIndusRelease --no-daemon
```

The expected output is:

```text
artifacts/focusflow/android/app/build/outputs/bundle/indusRelease/app-indus-release.aab
```

### Step 16: Validate and rename outputs

The workflow verifies both files exist before creating release assets:

```bash
APK="artifacts/focusflow/android/app/build/outputs/apk/indus/release/app-indus-universal-release.apk"
AAB="artifacts/focusflow/android/app/build/outputs/bundle/indusRelease/app-indus-release.aab"
test -f "$APK"
test -f "$AAB"
```

Then it copies them to predictable repository-root names:

```text
focusflow-indus-${{ github.ref_name }}.apk
focusflow-indus-${{ github.ref_name }}.aab
```

For tag `indus-v1.1.0`, the exact successful names were:

```text
focusflow-indus-indus-v1.1.0.apk
focusflow-indus-indus-v1.1.0.aab
```

### Step 17: Create or update the GitHub Release

Use `softprops/action-gh-release@v2` with:

```yaml
name: FocusFlow Indus ${{ github.ref_name }}
tag_name: ${{ github.ref_name }}
draft: false
prerelease: false
generate_release_notes: true
```

Upload both renamed files. The action can update the existing release when a
tag is deliberately rebuilt.

### Step 18: Remove the keystore safely

The cleanup step must run with `if: always()` but must not set its
`working-directory` to a directory that may not exist after an earlier
failure.

Use a repository-root-relative guard:

```bash
if [ -f artifacts/focusflow/android/app/release.keystore ]; then
  rm -f artifacts/focusflow/android/app/release.keystore
fi
```

The earlier form:

```yaml
working-directory: artifacts/focusflow/android/app
run: rm -f release.keystore
```

can fail before the shell starts if Expo prebuild or dependency installation
did not create `android/app`. A cleanup step must not hide the original
failure with a second missing-working-directory failure.

## 8. `eas.json` changes

The EAS profiles were changed from unqualified Gradle defaults to explicit
Play tasks:

```json
{
  "build": {
    "development": {
      "android": {
        "buildType": "apk",
        "gradleCommand": ":app:assemblePlayDebug"
      }
    },
    "preview": {
      "android": {
        "buildType": "apk",
        "gradleCommand": ":app:assemblePlayRelease"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle",
        "gradleCommand": ":app:bundlePlayRelease"
      }
    }
  }
}
```

The EAS profiles intentionally remain Play profiles. The Indus release is
handled by the dedicated tag workflow, which needs its own `indus` Gradle
tasks, output validation, and GitHub Release asset naming.

## 9. `package.json` changes

The FocusFlow package gained local native run scripts:

```json
{
  "scripts": {
    "android": "expo run:android",
    "ios": "expo run:ios"
  }
}
```

It also explicitly declared the runtime packages needed by the native Expo
project:

```json
{
  "dependencies": {
    "expo": "~54.0.33",
    "react": "19.1.0",
    "react-native": "0.81.5"
  }
}
```

The dependency placement matters. When a package is added or moved between
`dependencies` and `devDependencies`, regenerate the root lockfile. pnpm
compares the importer specifiers, not only the resolved package versions.

## 10. Lockfile rule

The initial flavour commit made `package.json` and `pnpm-lock.yaml`
temporarily disagree about where `expo`, `react`, and `react-native` belonged.
The runner correctly rejected that state:

```text
ERR_PNPM_OUTDATED_LOCKFILE
Cannot install with "frozen-lockfile"
```

The repaired importer placed the runtime packages under the dependency
section and removed the stale copies from the devDependency section. It also
updated pnpm's generated snapshot metadata, including peer references and
optional markers.

Future dependency changes must follow this sequence:

1. Edit the relevant package file.
2. Run a lockfile-only non-frozen update.
3. Run a frozen lockfile validation.
4. Inspect the diff for accidental package upgrades.
5. Commit `package.json` and `pnpm-lock.yaml` together.
6. Only then trigger the release workflow.

Recommended validation:

```bash
pnpm install --lockfile-only --no-frozen-lockfile --ignore-scripts
pnpm install --frozen-lockfile --lockfile-only --ignore-scripts
```

Do not “fix” CI by changing the release workflow to
`pnpm install --no-frozen-lockfile`. That makes the build depend on the
runner's current registry resolution and can silently change the Android
dependency graph.

## 11. What stays unchanged

The flavour implementation does not require:

- Renaming the Kotlin package from `com.tbtechs.focusflow`.
- Duplicating Kotlin files for Indus.
- Duplicating the Expo app.
- Changing the default `expo.android.package`.
- Changing database schemas or user data.
- Changing FocusFlow runtime policy code.
- Committing `android/` generated output.
- Committing a keystore or signing credentials.

The native source package and the Android application ID are independent
concepts. Android can install the Indus application ID while Kotlin classes
remain under the original package namespace.

The existing ProGuard keep rules for `com.tbtechs.focusflow.**` must remain in
place because both flavours use those classes.

## 12. Validation checklist for future flavour work

### Source/config checks

- [ ] `app.json` still uses `com.tbtechs.focusflow` as the configured/default
      package.
- [ ] The Play flavour uses `com.tbtechs.focusflow`.
- [ ] The Indus flavour uses a Gradle variable containing
      `com.tbtechsdev.focusflow`.
- [ ] The config plugin and `android-native/install.sh` contain equivalent
      flavour logic.
- [ ] The insertion is idempotent.
- [ ] The plugin still inserts before `buildTypes`.
- [ ] Kotlin package names remain unchanged.
- [ ] ProGuard rules still keep the native package.

### Dependency checks

- [ ] `package.json` and `pnpm-lock.yaml` agree.
- [ ] `pnpm install --frozen-lockfile` passes.
- [ ] No keystore or credential file is tracked.

### Generated Gradle checks

After a clean prebuild, inspect:

```bash
artifacts/focusflow/android/app/build.gradle
```

Confirm that it contains:

```groovy
flavorDimensions "store"
def focusFlowIndusApplicationId = "com.tbtechsdev.focusflow"
productFlavors {
    play {
        dimension "store"
        applicationId "com.tbtechs.focusflow"
    }
    indus {
        dimension "store"
        applicationId focusFlowIndusApplicationId
    }
}
```

Also confirm that the generated build file has:

- `signingConfigs.release` after the workflow signing patch.
- `enableV3Signing true`, not `v3SigningEnabled true`.
- R8/minification enabled as intended.
- ABI splits enabled for the APK build.

### Task checks

Use explicit tasks:

```bash
./gradlew assemblePlayDebug
./gradlew assemblePlayRelease
./gradlew bundlePlayRelease
./gradlew assembleIndusRelease
./gradlew bundleIndusRelease
```

Do not assume an unqualified task still represents the intended store.

### Artifact-path checks

Play:

```text
app/build/outputs/apk/play/debug/
app/build/outputs/apk/play/release/
app/build/outputs/bundle/playRelease/
```

Indus:

```text
app/build/outputs/apk/indus/release/
app/build/outputs/bundle/indusRelease/
```

### Workflow checks

- [ ] Normal Play builds trigger from their existing Play/tag path.
- [ ] Indus builds trigger only from `indus-v*`.
- [ ] The Indus workflow uses `assembleIndusRelease`.
- [ ] The Indus workflow disables ABI splits before
      `bundleIndusRelease`.
- [ ] Both output files are checked with `test -f`.
- [ ] The release action uploads both files.
- [ ] Cleanup uses a guarded path and cannot fail because `android/app` is
      missing.

## 13. Failure diagnosis

### `ERR_PNPM_OUTDATED_LOCKFILE`

Cause: a package file changed without a matching lockfile importer update.

Repair:

```bash
pnpm install --lockfile-only --no-frozen-lockfile --ignore-scripts
pnpm install --frozen-lockfile --lockfile-only --ignore-scripts
```

Commit both package and lockfile changes.

### Cleanup reports `android/app` does not exist

Cause: an earlier step failed before Expo generated the Android project, but
the cleanup step declared that missing directory as its working directory.

Repair the workflow cleanup to run from the repository root and test the file
before deleting it.

### `Could not find method v3SigningEnabled()`

Cause: obsolete AGP signing property spelling.

Use:

```groovy
enableV3Signing true
```

Do not change the property back to `v3SigningEnabled`.

### Indus artifact has the Play package ID

Cause: the alternate `applicationId` was written as a literal and Expo's
package modifier rewrote it during clean prebuild.

Use a Gradle variable:

```groovy
def focusFlowIndusApplicationId = "com.tbtechsdev.focusflow"
applicationId focusFlowIndusApplicationId
```

Inspect the generated Gradle file, not only the source plugin.

### `assembleRelease` or `bundleRelease` cannot select a variant

Cause: a flavour dimension exists but the workflow still uses an
unqualified task.

Use:

```bash
assemblePlayRelease
bundlePlayRelease
assembleIndusRelease
bundleIndusRelease
```

### Expected output file is missing

Cause: output paths and names changed when the `store` dimension was added.

Check the flavour-specific paths under:

```text
app/build/outputs/apk/<flavour>/release/
app/build/outputs/bundle/<flavour>Release/
```

Use `find` during diagnosis, but keep the final workflow's paths strict so
the release cannot upload an unintended artifact.

### AAB build fails after a successful APK build

Cause: ABI splits remain enabled or the generated Gradle file has a different
split syntax.

Disable both:

```properties
android.splits.abi.enable=false
android.splits.density.enable=false
```

Then run the flavour-specific bundle task.

## 14. Repeatable future implementation plan

When recreating this method after a reset or in another FocusFlow branch:

1. Confirm the desired default package in `app.json`.
2. Add the `store` dimension and `play`/`indus` flavours to the Expo config
   plugin.
3. Use a Gradle variable for the alternate Indus ID.
4. Mirror the same block in `android-native/install.sh`.
5. Change all Play debug/release entry points to explicit Play tasks.
6. Add the dedicated `indus-v*` release workflow.
7. Add signing config with `enableV3Signing`.
8. Keep signing credentials in environment variables and secrets.
9. Build the Indus APK with `assembleIndusRelease`.
10. Disable ABI splits before `bundleIndusRelease`.
11. Validate and rename the exact APK/AAB paths.
12. Publish both assets to the tag release.
13. Guard keystore cleanup from the repository root.
14. Regenerate and validate the pnpm lockfile.
15. Run a clean Expo prebuild and inspect generated Gradle output.
16. Trigger the tag workflow and inspect the complete job logs.

The order matters: dependency correctness must come before prebuild, prebuild
must come before Gradle patching, and Gradle patching must come before the
flavour-specific build tasks.

## 15. Proven successful result

The method was verified by the Indus tag workflow after the three fixes:

- GitHub Actions run: `33268971943`
- Tag: `indus-v1.1.0`
- Result: success
- Completed steps: 28
- APK: uploaded
- AAB: uploaded
- GitHub Release:
  https://github.com/TITANICBHAI/FocusFlow/releases/tag/indus-v1.1.0

The successful run proved all of the following together:

1. The lockfile was acceptable to frozen pnpm installation.
2. Clean Expo prebuild generated the Android project.
3. The flavour config was applied during prebuild.
4. The generated project accepted the signing configuration.
5. The `indusRelease` APK task completed.
6. The Indus AAB task completed after split disabling.
7. The expected output files existed.
8. Both release assets uploaded successfully.
9. The guarded cleanup step completed successfully.