#!/usr/bin/env node
/**
 * generate-release-notes.mjs
 *
 * Reads app.json, app/changelog.tsx, and app/onboarding.tsx from the
 * artifacts/focusflow workspace and writes a rich Markdown release body
 * to  release-body.md  (repo root).
 *
 * Usage:
 *   node scripts/generate-release-notes.mjs
 *
 * Environment variables (all optional):
 *   APP_DIR   — path to the Expo app dir  (default: artifacts/focusflow)
 *   OUT_FILE  — output path               (default: release-body.md)
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT    = path.resolve(__dirname, '..');
const APP_DIR = path.resolve(ROOT, process.env.APP_DIR ?? 'artifacts/focusflow');
const OUT     = path.resolve(ROOT, process.env.OUT_FILE ?? 'release-body.md');

// ─────────────────────────────────────────────────────────────────────────────
// Constants  (must be declared before the functions that reference them)
// ─────────────────────────────────────────────────────────────────────────────

const ICON_EMOJI = {
  'hourglass':      '⏳',
  'wifi':           '📶',
  'bug':            '🐛',
  'nuclear':        '☢️',
  'shield':         '🛡️',
  'warning':        '⚠️',
  'analytics':      '📊',
  'time':           '🕐',
  'document':       '📄',
  'calendar':       '📅',
  'ban':            '🚫',
  'bar-chart':      '📈',
  'sync':           '🔄',
  'notifications':  '🔔',
  'settings':       '⚙️',
  'lock':           '🔒',
  'key':            '🔑',
  'layers':         '🗂️',
  'eye':            '👁️',
  'power':          '⚡',
  'checkmark':      '✅',
  'information':    'ℹ️',
};

const HOW_TITLE_EMOJI = {
  'Schedule': '📅',
  'Block Apps': '🚫',
  'Lock':      '🔒',
  'Track':     '📊',
  'Side Menu': '☰',
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function log(msg) { process.stderr.write(`[release-notes] ${msg}\n`); }

function iconToEmoji(icon) {
  const key = Object.keys(ICON_EMOJI).find(k => icon.toLowerCase().includes(k));
  return key ? ICON_EMOJI[key] : '🔹';
}

function howTitleEmoji(title) {
  const key = Object.keys(HOW_TITLE_EMOJI).find(k => title.includes(k));
  return key ? HOW_TITLE_EMOJI[key] : '▶️';
}

// ─────────────────────────────────────────────────────────────────────────────
// Parsers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return true if `line` contains any version: '...' declaration.
 * When `version` is provided, only matches that exact version.
 */
function matchesVersion(line, version) {
  if (version === null) return /version:\s*['"][^'"]+['"]/.test(line);
  return line.includes(`version: '${version}'`) || line.includes(`version: "${version}"`);
}

/**
 * Extract sections for `targetVersion` from changelog.tsx source.
 * Returns array of { heading, icon, items[] }.
 */
function parseChangelog(src, targetVersion) {
  const lines    = src.split('\n');
  const sections = [];

  let capturing    = false;
  let inItems      = false;
  let currentHead  = null;
  let currentIcon  = null;
  let currentItems = [];

  function flushSection() {
    if (currentHead && currentItems.length > 0) {
      sections.push({ heading: currentHead, icon: currentIcon ?? '', items: [...currentItems] });
    }
    currentHead  = null;
    currentIcon  = null;
    currentItems = [];
    inItems      = false;
  }

  for (const line of lines) {
    if (!capturing) {
      if (matchesVersion(line, targetVersion)) capturing = true;
      continue;
    }

    // Stop when we hit a *different* version entry
    if (matchesVersion(line, null) && !matchesVersion(line, targetVersion)) {
      flushSection();
      break;
    }

    const hm = line.match(/heading:\s*['"]([^'"]+)['"]/);
    if (hm) { flushSection(); currentHead = hm[1]; continue; }

    const im = line.match(/icon:\s*['"]([^'"]+)['"]/);
    if (im && currentHead !== null) { currentIcon = im[1]; continue; }

    if (/items:\s*\[/.test(line)) { inItems = true; continue; }
    if (inItems && /^\s+\],/.test(line)) { inItems = false; continue; }

    if (inItems) {
      // Match '...' or "..." on an indented item line
      const sm = line.match(/^\s{6,}['"](.+?)['"]\s*,?\s*$/);
      if (sm && sm[1].length > 8) currentItems.push(sm[1]);
    }
  }

  flushSection();
  return sections;
}

/**
 * Extract HOW_TO_SECTIONS from onboarding.tsx source.
 * Returns array of { title, tip }.
 */
function parseHowTo(src) {
  const lines  = src.split('\n');
  const result = [];

  let inBlock = false;
  let title   = null;
  let tip     = null;

  for (const line of lines) {
    if (!inBlock) {
      if (/const HOW_TO_SECTIONS\s*=\s*\[/.test(line)) inBlock = true;
      continue;
    }
    if (/^];/.test(line) || /^const /.test(line)) break;

    const tm = line.match(/title:\s*['"]([^'"]+)['"]/);
    if (tm) { title = tm[1]; continue; }

    const tpm = line.match(/tip:\s*['"](.+?)['"]\s*,?\s*$/);
    if (tpm) { tip = tpm[1]; }

    if (title && tip && (/\},/.test(line) || /^\s+\}/.test(line))) {
      result.push({ title, tip });
      title = null;
      tip   = null;
    }
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Composer
// ─────────────────────────────────────────────────────────────────────────────

function compose({ appName, version, versionCode, changelogSections, howToSections }) {
  const p = [];

  // Header
  p.push(`## 🎉 ${appName} v${version}`);
  p.push('');
  p.push(`> **Version code:** ${versionCode} &nbsp;|&nbsp; **Platform:** Android`);
  p.push('');

  // Changelog
  if (changelogSections.length > 0) {
    p.push('---');
    p.push('');
    p.push("## 📋 What's New");
    p.push('');
    for (const { heading, icon, items } of changelogSections) {
      p.push(`### ${iconToEmoji(icon)} ${heading}`);
      for (const item of items) {
        const short = item.length > 220 ? item.slice(0, 217) + '…' : item;
        p.push(`- ${short}`);
      }
      p.push('');
    }
  }

  // New-user quick start
  if (howToSections.length > 0) {
    p.push('---');
    p.push('');
    p.push('## 🚀 New to FocusFlow? Start here');
    p.push('');
    for (const { title, tip } of howToSections) {
      p.push(`**${howTitleEmoji(title)} ${title}**`);
      p.push(`> ${tip}`);
      p.push('');
    }
  }

  // SAI / Restricted Settings warning
  p.push('---');
  p.push('');
  p.push('## ⚠️ Sideloaded APK? Complete this before enabling Accessibility (Android 13+)');
  p.push('');
  p.push(
    'Android 13+ **greys out** the Accessibility Service and Device Admin toggles for ' +
    'sideloaded apps until you manually allow them. This is a system security feature, not a ' +
    'FocusFlow bug. **Without completing this step, app blocking will not work.**'
  );
  p.push('');
  p.push('**One-time unlock — ~10 seconds:**');
  p.push('');
  p.push('1. Open **App Info** for FocusFlow (path varies by OEM — see table below)');
  p.push('2. Tap the **⋮ three-dot menu** in the top-right corner');
  p.push('3. Tap **"Allow restricted settings"**');
  p.push('4. Return to FocusFlow — the Accessibility toggle will now work');
  p.push('');
  p.push('This unlock persists permanently — you will never see it again on this install.');
  p.push('');
  p.push('| OEM / ROM | Path to App Info |');
  p.push('|-----------|-----------------|');
  p.push('| **Stock Android / Pixel** | Settings → Apps → FocusFlow |');
  p.push('| **Samsung One UI** | Settings → General management → App info → FocusFlow |');
  p.push('| **Xiaomi / MIUI / HyperOS** | Settings → Apps → Manage apps → FocusFlow |');
  p.push('| **OnePlus / OxygenOS** | Settings → Apps → App info → FocusFlow |');
  p.push('| **Realme / ColorOS** | Settings → Apps → App Management → FocusFlow |');
  p.push('| **Vivo / FuntouchOS** | Settings → Apps → FocusFlow |');
  p.push('| **Motorola** | Settings → Apps → See all apps → FocusFlow |');
  p.push('| **Huawei / EMUI** | Settings → Apps → Apps → FocusFlow |');
  p.push('');
  p.push('> 💡 **Samsung users:** OneUI often handles this automatically — you may be able to skip straight to enabling Accessibility.');
  p.push('> 💡 **Play Store users:** Restricted Settings do not apply — skip this section.');
  p.push('');

  // Download guide
  p.push('---');
  p.push('');
  p.push('## 📦 Which APK should I download?');
  p.push('');
  p.push('| File | Who it\'s for |');
  p.push('|------|-------------|');
  p.push(`| \`focusflow-v${version}-arm64.apk\` | ✅ **Most phones (2017+)** — recommended for almost everyone |`);
  p.push(`| \`focusflow-v${version}-arm32.apk\` | Older 32-bit phones |`);
  p.push(`| \`focusflow-v${version}-universal.apk\` | Any phone — larger download, use if unsure which to pick |`);
  p.push(`| \`focusflow-v${version}.aab\` | Play Store upload only — not directly installable on a device |`);
  p.push('');
  p.push('> Not sure? Grab the **arm64** APK. If it says "App not installed", try **universal**.');
  p.push('');

  return p.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

const appJson     = JSON.parse(fs.readFileSync(path.join(APP_DIR, 'app.json'), 'utf8'));
const version     = appJson.expo.version;
const versionCode = appJson.expo.android.versionCode;
const appName     = appJson.expo.name ?? 'FocusFlow';

log(`Generating release notes for ${appName} v${version} (versionCode ${versionCode})`);

const changelogSrc      = fs.readFileSync(path.join(APP_DIR, 'app', 'changelog.tsx'), 'utf8');
const changelogSections = parseChangelog(changelogSrc, version);
log(`Changelog sections found for v${version}: ${changelogSections.length}`);

const onboardingSrc = fs.readFileSync(path.join(APP_DIR, 'app', 'onboarding.tsx'), 'utf8');
const howToSections = parseHowTo(onboardingSrc);
log(`How-to tips found: ${howToSections.length}`);

const body = compose({ appName, version, versionCode, changelogSections, howToSections });

fs.writeFileSync(OUT, body, 'utf8');
log(`Written to ${OUT}`);
