# What's New — FocusFlow v1.0.8

## New Two-Mode Onboarding

FocusFlow v1.0.8 introduces a new two-mode first-run setup so users can choose
the right level of protection:

- **Standard Mode** keeps setup focused on the essential access required for
  app blocking.
- **Iron Mode** adds layered setup for VPN network restriction, Device Admin
  resistance, and Defense Password protection.
- Both modes use a clearer, more readable setup hierarchy.
- Iron Mode uses indigo for the main activation experience and orange only for
  stronger-protection emphasis.
- A live protection-layer counter shows exactly how much of the setup is active.
- Checkmarks animate only when real permission states become active.
- Reduced-motion preferences are respected without adding a new animation package.

---

## Database Reliability

FocusFlow v1.0.8 strengthens the local SQLite data layer:

- Database connections are opened, reused, and closed predictably.
- Related task and settings updates use safer transaction boundaries.
- Failed writes preserve the previous in-memory state instead of silently
  discarding changes.
- Persisted values and imported backup data receive defensive validation.
- Local queries use parameters, and diagnostic logging avoids exposing user
  content.

---

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
