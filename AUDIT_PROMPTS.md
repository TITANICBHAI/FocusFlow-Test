# Audit Prompts

Precision-first prompts. Every prompt follows the same anti-hallucination contract:
**enumerate from source → cross-reference → diff → cite evidence**.
Never ask "what's missing?" directly — always build both sides of the comparison from actual file reads first.

---

## Prompt A — FocusFlow Full Audit (tip to toe)

```
You are doing a complete audit of this Expo/React Native Android codebase.
Work through every section below in order. Do not skip any section.
For every finding, cite the exact file path and line number.
Only report something as a gap or bug if you have read both sides of the comparison yourself.
Never guess. If you cannot confirm something from file content, say "could not verify — file not read."

─────────────────────────────────────────────────
SECTION 1 — MANIFEST WIRING
─────────────────────────────────────────────────
1a. Read every .kt file under:
    artifacts/focusflow/android-native/app/src/main/java/com/tbtechs/focusflow/
    Classify each as: Activity | Service | Receiver | Module | Helper
    Output the full classified list.

1b. Read artifacts/focusflow/plugins/withFocusDayAndroid.js.
    List every android:name value registered under <activity>, <service>, <receiver>.

1c. Diff 1a vs 1b.
    Flag any Activity, Service, or Receiver from 1a absent from 1b.
    For each gap: state the class, the consequence of missing registration at runtime,
    and the exact plugin block to add (template from the nearest existing entry).
    Helpers never need registration — exclude them and explain why.

─────────────────────────────────────────────────
SECTION 2 — REACT NATIVE BRIDGE COMPLETENESS
─────────────────────────────────────────────────
2a. Read FocusDayPackage.kt.
    List every module class in createNativeModules listOf(...).

2b. For every module in 2a, read its .kt file and list every @ReactMethod.

2c. Read every corresponding JS bridge file under:
    artifacts/focusflow/src/native-modules/
    List every method exported from each file.

2d. For each module: diff the @ReactMethod list (2b) against the JS exports (2c).
    Flag: methods in Kotlin with no JS counterpart (callable from native but unreachable from JS).
    Flag: methods in JS with no Kotlin counterpart (JS calls that will throw NativeModule null error).

─────────────────────────────────────────────────
SECTION 3 — SHAREDPREFERENCES SCHEMA CONSISTENCY
─────────────────────────────────────────────────
3a. Read SharedPrefsModule.kt and SharedPrefsModule.ts.
    List every key string used in Kotlin reads/writes.
    List every key string used in JS reads/writes.

3b. Scan all other Kotlin service/receiver files for direct SharedPreferences access
    (getSharedPreferences, getString, getBoolean, getLong, putString, etc.).
    List every key used.

3c. Scan all JS/TS files under artifacts/focusflow/src/ for SharedPrefs key references.
    List every key used.

3d. Produce a master key table: key name | used in Kotlin | used in JS | type agreement.
    Flag: keys used in JS but never written in Kotlin (JS will always get the default/null).
    Flag: keys used in Kotlin but never read in JS (data written but never surfaced to the user).
    Flag: same key read as different types in Kotlin vs JS (type mismatch → silent wrong value).

─────────────────────────────────────────────────
SECTION 4 — PERMISSIONS: DECLARED VS RUNTIME-REQUESTED
─────────────────────────────────────────────────
4a. Read the permissions array in withFocusDayAndroid.js.
    List every permission string declared.

4b. Read app.json → plugins and any direct permission entries there.
    List every permission declared there.

4c. Scan all JS/TS files for runtime permission requests
    (PermissionsAndroid.request, expo-permissions, Linking.openSettings, etc.).
    List every permission requested at runtime and in which file.

4d. Scan all Kotlin files for permission checks
    (checkSelfPermission, shouldShowRequestPermissionRationale, Settings.canDrawOverlays, etc.).
    List every permission checked.

4e. Cross-reference:
    Flag: permissions declared in manifest but never checked or requested at runtime
          (declared but dead — user is never asked, feature silently fails).
    Flag: permissions checked at runtime but not declared in manifest
          (will always be denied on Android — guaranteed runtime failure).

─────────────────────────────────────────────────
SECTION 5 — SERVICE LIFECYCLE SYMMETRY
─────────────────────────────────────────────────
5a. For each Service declared in the plugin, find every call site that starts it
    (startService, startForegroundService, bindService).
    Find every call site that stops it (stopService, stopSelf, unbindService).

5b. Check ForegroundTaskService specifically:
    - Does every code path that calls startForegroundService have a matching stop path?
    - Does the service ever call stopSelf() when it should stay alive (goes IDLE instead)?
    - Is BootReceiver correctly restarting the service in both ACTIVE and IDLE states?

5c. Check NetworkBlockerVpnService:
    - Is VpnWatchdogReceiver being scheduled AND cancelled symmetrically
      (scheduled on start, cancelled on stop)?
    - Is there a path where the VPN stops but the watchdog alarm is never cancelled
      (watchdog fires forever with no VPN to watch)?

5d. For each gap found: state the file, the method, and the consequence.

─────────────────────────────────────────────────
SECTION 6 — ALARMMANAGER REGISTRATION SYMMETRY
─────────────────────────────────────────────────
6a. Find every AlarmManager.set / setExact / setAlarmClock / setRepeating call in Kotlin.
    For each: what receiver/intent does it target, and in which method is it scheduled?

6b. Find every AlarmManager.cancel call.
    For each: what PendingIntent does it cancel, and in which method?

6c. Diff 6a vs 6b.
    Flag any alarm that is set but has no corresponding cancel path.
    Flag any cancel that targets a PendingIntent that is never set (dead cancel).

─────────────────────────────────────────────────
SECTION 7 — BUILD PLUGIN vs APP.JSON CONSISTENCY
─────────────────────────────────────────────────
7a. Read app.json. List: package name, versionCode, versionName, permissions array,
    plugins array, sdkVersion, androidStatusBar, splash, icon, scheme.

7b. Read withFocusDayAndroid.js. List: package name assumptions, hardcoded strings,
    permission strings, any values that must match app.json to work correctly.

7c. Read eas.json. List: all build profiles and their credentialsSource, buildType,
    autoIncrement, env vars.

7d. Cross-reference:
    Flag: any hardcoded value in the plugin that contradicts app.json.
    Flag: any EAS build profile missing an env var that the app reads at build time.
    Flag: credentialsSource: "local" profiles where the keystore files are missing
          from the repo (check artifacts/focusflow/android/).

─────────────────────────────────────────────────
SECTION 8 — TYPESCRIPT / JS LAYER INTEGRITY
─────────────────────────────────────────────────
8a. Run a mental type-check on AppContext.tsx:
    - Every value stored in context: is it typed, or typed as `any`?
    - Every native module call: is the return value typed, or cast unsafely?

8b. Scan for all TODO, FIXME, HACK, @ts-ignore, @ts-expect-error, as any, as unknown
    in artifacts/focusflow/src/. List every occurrence with file + line.

8c. Check every screen file under artifacts/focusflow/app/ for:
    - useEffect with missing or incorrect dependency arrays
    - Event listeners (AppState, Linking, BackHandler) that are added but never removed

8d. For each finding: file, line, severity (crash risk | silent wrong behavior | code smell).

─────────────────────────────────────────────────
OUTPUT FORMAT
─────────────────────────────────────────────────
For each section, output:
  SECTION N — [name]
  Status: CLEAN | GAPS FOUND
  Findings: (numbered list, each with file:line, description, consequence, fix)

End with a SUMMARY TABLE:
  | Section | Status | Finding count |
```

---

## Prompt B — Any Project: Wiring & Registration Audit

```
You are auditing this codebase for wiring gaps — components that are defined but
never connected to the runtime. A gap means the code exists but has zero effect
because nothing registers, imports, routes, or calls it.

Work through every step. Only report a gap after confirming both sides from file reads.
Never infer. Cite file:line for every claim.

─────────────────────────────────────────────────
STEP 1 — MAP ALL REGISTRATION SURFACES
─────────────────────────────────────────────────
Read the project structure: package.json, entrypoints, router config, DI container,
plugin arrays, manifest, migration runner, cron/job scheduler, event bus, service locator —
whatever is relevant to this stack.

List every surface where a component must be explicitly registered to be active.
For each surface: file path, what it registers, how you add a new entry.

─────────────────────────────────────────────────
STEP 2 — ENUMERATE ALL IMPLEMENTATIONS
─────────────────────────────────────────────────
For each registration surface from Step 1, find all implementation files
that correspond to that surface (e.g. all route handlers, all DI providers,
all manifest-declared components, all scheduled jobs, etc.).

List them: file path + class or function name.
Only list files you have read. Do not infer from directory names alone.

─────────────────────────────────────────────────
STEP 3 — DIFF
─────────────────────────────────────────────────
For each registration surface: compare Step 2 implementations against what is
actually referenced in the surface file.

Flag every implementation present in Step 2 but absent from the surface file.

─────────────────────────────────────────────────
STEP 4 — FOR EACH GAP
─────────────────────────────────────────────────
State:
  - File that defines it (path:line of the class/function declaration)
  - Surface file where it should be registered (path:line of the nearest existing entry)
  - Runtime consequence: silent failure | crash | feature unreachable | security bypass
  - Exact lines to add (copy the nearest registered entry as a template, do not invent syntax)

─────────────────────────────────────────────────
STEP 5 — INVERSE CHECK (dead registrations)
─────────────────────────────────────────────────
Check the other direction: entries in the registration surface that point to
implementations that no longer exist (deleted files, renamed classes).
Flag each: surface file:line | what it references | why it's dead | what to do.

─────────────────────────────────────────────────
OUTPUT FORMAT
─────────────────────────────────────────────────
Surface: [name] ([file])
  Gaps:    [numbered list]
  Dead:    [numbered list]
  Status:  CLEAN | ISSUES FOUND

Final summary table:
  | Surface | Gaps | Dead refs | Status |
```

---

## Prompt C — Any Project: Security & Data Flow Audit

```
You are auditing this codebase for security issues and unintended data flows.
Work through every section. Cite file:line for every finding.
Do not report a vulnerability unless you can show the exact code path that triggers it.
No theoretical issues — only confirmed ones from file reads.

─────────────────────────────────────────────────
SECTION 1 — WHAT LEAVES THE PROCESS
─────────────────────────────────────────────────
Find every outbound channel: HTTP/HTTPS calls, WebSockets, IPC, file writes to
shared storage, clipboard writes, broadcast sends with exported=true, logs.

For each: file:line | destination (URL, file path, IPC target) | what data is sent |
is it user-controlled input | is it encrypted in transit | can it be intercepted.

─────────────────────────────────────────────────
SECTION 2 — SECRETS & CREDENTIALS IN CODE
─────────────────────────────────────────────────
Scan for: hardcoded API keys, tokens, passwords, connection strings, base64-encoded
secrets, private keys, any string that looks like a credential.
Check: .env files, config files, source files, build scripts, CI configs.

For each: file:line | what it is | exposure risk (committed to repo / logged / sent over network).

─────────────────────────────────────────────────
SECTION 3 — INPUT HANDLING
─────────────────────────────────────────────────
Find every place user-supplied input enters the system (form fields, URL params,
deep link URIs, IPC payloads, file contents, push notification data).

For each input source, trace the value:
  - Is it validated before use?
  - Is it sanitized before being written to storage, logged, or sent to an API?
  - Can it be used to construct a file path, SQL query, shell command, or URL
    without sanitization (path traversal, injection)?

Flag every path where unsanitized input reaches a dangerous sink.

─────────────────────────────────────────────────
SECTION 4 — EXPORTED COMPONENTS (Android) / PUBLIC ENDPOINTS
─────────────────────────────────────────────────
For Android: list every component with android:exported="true".
For each: is it intentionally public? Does it accept an Intent/URI? Can an external
app send a malicious intent to trigger unintended behavior?

For web/API: list every route that requires no authentication.
For each: is that intentional? Can it be used to read or write data it shouldn't?

─────────────────────────────────────────────────
SECTION 5 — DEPENDENCY SURFACE
─────────────────────────────────────────────────
Read package.json (and any lock file summary).
Flag: packages with known CVEs (check the version against known vulnerability databases
you have training data for — note your knowledge cutoff and flag anything you are unsure of).
Flag: packages that are wildly outdated (major version behind latest known to you).
Flag: dev dependencies that are also listed in production dependencies.

─────────────────────────────────────────────────
SECTION 6 — ERROR HANDLING & INFORMATION DISCLOSURE
─────────────────────────────────────────────────
Find every catch block, error handler, and Promise rejection handler.
Flag: stack traces or internal error details returned to the client / shown to the user
in production builds (information disclosure).
Flag: empty catch blocks that swallow errors silently (silent failures that look like success).
Flag: error messages that reveal internal paths, DB schema, or dependency versions.

─────────────────────────────────────────────────
OUTPUT FORMAT
─────────────────────────────────────────────────
Section N — [name]
  Severity: CRITICAL | HIGH | MEDIUM | LOW | INFO
  Finding [n]: file:line — description — reproduction path — recommended fix

Final priority table (critical and high first):
  | # | Severity | File:line | Short description |
```

---

## Prompt D — Any Project: Contract & Schema Consistency Audit

```
You are auditing this codebase for contract mismatches — places where two sides
of a boundary disagree about shape, type, or value, causing silent failures, wrong
data, or crashes that only show up at runtime.

Boundaries to check: API client vs server, DB schema vs ORM model vs application code,
config/env keys vs their consumers, event producers vs consumers, serialized data
written in one place and read in another.

For every finding: cite both sides (file:line for each), state what each side expects,
and state the runtime consequence of the mismatch.
Only report a mismatch after reading both sides. Never infer.

─────────────────────────────────────────────────
SECTION 1 — API CONTRACTS
─────────────────────────────────────────────────
1a. Find every API call made by the client (fetch, axios, SDK call, etc.).
    For each: endpoint, HTTP method, request body shape, expected response shape.

1b. Find every corresponding server handler (route + controller).
    For each: what body shape it expects, what response shape it returns.

1c. Diff 1a vs 1b.
    Flag: field present in client request body but not read by server (wasted data).
    Flag: field expected in server response but not present in server's actual return (undefined at runtime).
    Flag: type mismatches (client sends string, server expects number, etc.).
    Flag: endpoints called by client that do not exist on server (guaranteed 404).
    Flag: server endpoints that no client calls (dead routes — may or may not be intentional).

─────────────────────────────────────────────────
SECTION 2 — DATABASE SCHEMA VS APPLICATION CODE
─────────────────────────────────────────────────
2a. Read the DB schema (migration files, ORM model definitions, schema.prisma, etc.).
    List every table, every column, its type, nullable, default.

2b. Read every place the application reads from or writes to the DB.
    List every column name referenced in queries or ORM calls.

2c. Diff 2a vs 2b.
    Flag: column referenced in code but not in schema (query will error at runtime).
    Flag: column in schema but never referenced in code (dead column — migration debt or missing feature).
    Flag: nullable column read without null-check (potential null-dereference).
    Flag: type in schema vs type assumed in code (e.g. DB returns string, code does math on it).

─────────────────────────────────────────────────
SECTION 3 — CONFIG / ENVIRONMENT KEYS
─────────────────────────────────────────────────
3a. Find every place an environment variable or config key is read
    (process.env.X, os.getenv, Config.get, etc.).
    List: key name | file:line | what happens if it is missing or empty.

3b. Find every place env vars are defined or documented
    (.env.example, README, docker-compose, CI secrets, etc.).
    List: key name | where defined.

3c. Diff 3a vs 3b.
    Flag: keys read in code but not in any .env.example or docs (undocumented dependency —
    app will silently break in a fresh environment).
    Flag: keys documented but never read (stale documentation — misleads new developers).
    Flag: keys with no fallback where missing would crash or corrupt data.

─────────────────────────────────────────────────
SECTION 4 — EVENT / MESSAGE CONTRACTS
─────────────────────────────────────────────────
4a. Find every event emitted (EventEmitter.emit, postMessage, broadcast, publish, dispatch).
    For each: event name | payload shape | file:line.

4b. Find every event listener (on, addEventListener, subscribe, addListener).
    For each: event name | expected payload shape | file:line.

4c. Diff 4a vs 4b.
    Flag: events emitted with no listener (fire and forget that was meant to be handled).
    Flag: listeners registered for events that are never emitted (dead listener).
    Flag: payload shape mismatch between emitter and listener (fields that will be undefined).

─────────────────────────────────────────────────
SECTION 5 — SERIALIZATION ROUND-TRIPS
─────────────────────────────────────────────────
Find every place data is serialized to be stored and later deserialized:
JSON.stringify/parse, SharedPreferences string fields that store JSON arrays,
localStorage, AsyncStorage, file writes intended to be re-read.

For each round-trip:
  - What is the write-side shape? (file:line)
  - What is the read-side shape assumption? (file:line)
  - Are they in sync? If the write-side schema changed, was the read-side updated too?
  - Is there a migration path if the stored format changes between app versions?

Flag any round-trip where the write and read shapes differ, or where there is no
migration strategy for a schema change on persistent data.

─────────────────────────────────────────────────
OUTPUT FORMAT
─────────────────────────────────────────────────
Section N — [name]
  Finding [n]:
    Side A: file:line — [what it expects/sends]
    Side B: file:line — [what it actually provides]
    Mismatch: [description]
    Runtime consequence: [what breaks and when]
    Fix: [concrete change needed]

Final summary table:
  | # | Section | File A | File B | Consequence | Severity |
```
