# TBTechs Android Release Keystore Guide

## What is the keystore?

The keystore (`tbtechs-release.keystore`) is a file that contains your signing identity.
Every Android app you publish **must** be signed with it. Google Play uses the signature
to verify that updates to your app come from you and nobody else.

**If you lose the keystore you can never update your app on the Play Store.**
Back it up to Google Drive, iCloud, or a USB drive — somewhere outside Replit.

---

## Files generated

| File | What it is |
|---|---|
| `tbtechs-release.keystore` | The keystore file containing all your signing keys |

### Keystore details

| Field | Value |
|---|---|
| Keystore file | `tbtechs-release.keystore` |
| Store password | `TBTechs@2024!` |
| Organization | TBTechs |
| Validity | 10,000 days (~27 years) |

---

## Step 1 — Add secrets to GitHub

Go to your repo → **Settings → Secrets and variables → Actions → New repository secret**
and add these 4 secrets exactly:

| Secret name | Value |
|---|---|
| `RELEASE_KEYSTORE_BASE64` | *(the long base64 string from chat)* |
| `RELEASE_STORE_PASSWORD` | `TBTechs@2024!` |
| `RELEASE_KEY_ALIAS` | `focusflow` |
| `RELEASE_KEY_PASSWORD` | `TBTechs@2024!` |

Once added, go to **Actions → Build Production (APK + AAB) → Run workflow** to trigger a build.

---

## Does EAS pick these up automatically?

**No.** These secrets are only for the GitHub Actions workflows (`build-release.yml`).
EAS (Expo Application Services) is a separate cloud build service with its own credentials system.
The workflows in this repo do **not** use EAS — they build directly with Gradle.

---

## Using the same keystore for another app

You do **not** need a new keystore file. Just add a new key alias to the existing one.

### Add a new app key

Run this in the Replit shell (replace `myapp` and `MyApp Name`):

```bash
keytool -genkeypair -v \
  -keystore tbtechs-release.keystore \
  -alias myapp \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -dname "CN=TBTechs, OU=Dev, O=TBTechs, L=Unknown, S=Unknown, C=US" \
  -storepass TBTechs@2024! \
  -keypass TBTechs@2024!
```

Then re-encode the keystore (the new app key is now inside it):

```bash
base64 -w0 tbtechs-release.keystore
```

Update `RELEASE_KEYSTORE_BASE64` in GitHub with the new output, and set
`RELEASE_KEY_ALIAS` to `myapp` for that repo's secrets.

### Alias list so far

| Alias | App | Added |
|---|---|---|
| `focusflow` | FocusFlow | April 2026 |

---

## What the workflows build

### `build-debug.yml` — runs on every push to `main`
- Builds an **unsigned debug APK**
- No secrets needed
- Good for testing on a device during development
- Output: `focusflow-debug-<run>.apk` (kept 14 days)

### `build-release.yml` — manual trigger only
- Builds a **signed release APK** — sideload or share directly
- Builds a **signed release AAB** — upload to Google Play Store
- Requires all 4 keystore secrets (Step 1 above)
- Output: `focusflow-release-apk-<run>.apk` + `focusflow-release-aab-<run>.aab` (kept 30 days)

---

## APK vs AAB — which to use where?

| Format | Use for |
|---|---|
| **APK** | Direct install on a device, beta testers via sharing, Firebase App Distribution |
| **AAB** | Google Play Store (required since Aug 2021 for new apps) |

When you upload an AAB to the Play Store, Google generates optimised APKs for each
device type automatically — smaller download sizes for your users.

---

## Downloading build outputs

After a workflow run completes:

1. Go to your repo on GitHub
2. Click **Actions**
3. Click the completed workflow run
4. Scroll to **Artifacts** at the bottom
5. Download the APK or AAB

---

## Uploading to Google Play Store

1. Go to [play.google.com/console](https://play.google.com/console)
2. Create your app (or open an existing one)
3. Go to **Production → Releases → Create new release**
4. Upload the `.aab` file from the artifact
5. Fill in release notes and submit for review

For internal testing before production, use the **Internal testing** track instead.

---

## Emergency: if you need to re-generate the base64

If you need the base64 string again (e.g. to add to a new repo), run in Replit shell:

```bash
base64 -w0 tbtechs-release.keystore
```

The keystore file is already in the workspace — just re-encode it.
