# What's New — FocusFlow v1.0.3

## Bug Fixes

### App data appearing empty mid-session
Tasks could appear to vanish while the app was open, then return after a phone
restart. This happened because Android silently killed the SQLite connection
when the app was backgrounded. When the user came back, React still showed the
old (now dead) state — there was no code to recover the database handle on
foreground resume.

**Fixed:** The app now detects every transition from background → foreground,
resets the database connection, and immediately reloads your tasks. The
recovery takes a few milliseconds and is invisible during normal use. A phone
restart is no longer needed to see your data again.

---

### Release build improvements
Two bugs in the automated release pipeline were resolved:

- The signing configuration script incorrectly injected a property into the
  wrong block of the Gradle build file, which caused all APK signing to fail
  silently.
- A property (`v3SigningEnabled`) that is not valid in Android Gradle Plugin 8.x
  was being written into the build config. V3 signing is automatic when V2 is
  enabled — no explicit flag is needed.

Both issues are fixed. Signed APKs and AABs now build and verify correctly on
the first attempt.

---

## Internal Changes

### Diagnostic logging removed from release builds
The startup logger (previously used to diagnose early-launch issues on OEM
devices) is now a complete no-op in release builds. It no longer writes to
memory, AsyncStorage, or the file system in production. The Diagnostics section
in Settings is also hidden. Debug builds are unaffected — the logger still
works exactly as before during development.

The underlying issues that required this logging (SQLite handle loss, missed
foreground transitions) are resolved. Removing it from production reduces
storage I/O on every app launch.

---

## Systems audited this release

### Daily Allowance
Reviewed enforcement logic in full — count mode, time-budget mode, and interval
mode. The midnight-crossing accumulator, window-expiry boundary, and rapid
re-open guard (5× retry at 150 ms) all check out. No issues found.

### VPN / Network Blocker
Reviewed the VPN tunnel lifecycle, self-heal path, and permission-loss handling.
The single-attempt self-heal on `onRevoke` is safe (it does not loop). The
permission-lost flag is correctly cleared on a successful re-establish. No
issues found.
