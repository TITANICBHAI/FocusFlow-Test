---
name: Import guard
description: What to skip when this project is freshly imported — prevents wasted token spend on setup the user didn't ask for.
---

## Rule
When assigned "Set up the imported project" (or any import/onboarding task), do NOT:
- Run `pnpm install` or any dependency install
- Configure or start any workflow
- Attempt to run or preview the app
- Read more than ~30 lines of Readme.md to orient yourself

## Why
The main artifact (`artifacts/focusflow`) is an Expo Android app. It cannot run in a browser preview — it builds to an APK via EAS CLI. Doing setup work before the user asks for it costs tokens and produces nothing useful.

The web packages (mockup-sandbox, focusflow-ad, feature-videos) CAN run in browser, but the user may not want them started.

## What to do instead
Skim `Readme.md` (first 30 lines) + glance at `artifacts/` listing, then immediately ask the user what they want via AskQuestion. One question, four options: run web packages, edit Android app code, set up EAS build, or no setup needed.
