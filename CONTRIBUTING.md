# Contributing to FocusFlow

Thank you for your interest in improving FocusFlow. Contributions are
welcome, including bug fixes, documentation, accessibility improvements, and
carefully scoped features.

## Before you start

1. Search existing issues and pull requests to avoid duplicate work.
2. For a significant feature or architectural change, open an issue first to
   discuss the approach.
3. Read the [Code of Conduct](CODE_OF_CONDUCT.md).
4. Never include passwords, API keys, signing keys, private user data, or other
   secrets in an issue or pull request.

## Project layout

- `artifacts/focusflow` — Expo/React Native Android app and custom Kotlin
  enforcement services.
- `artifacts/mockup-sandbox` — web-based UI preview and mockup workspace.
- `scripts` — repository utility scripts.
- `docs` — project documentation and generated web content.

FocusFlow has an important split between the React Native control plane and the
Kotlin enforcement plane. Changes to blocking, permissions, timers, or native
services should preserve the existing safety boundaries and be tested on an
Android device when possible.

## Development setup

Requirements:

- Node.js 20 or newer
- pnpm
- Java and Android tooling for native Android builds

Install workspace dependencies:

```bash
pnpm install
```

Run the main web preview:

```bash
pnpm --filter @workspace/mockup-sandbox run dev
```

Run FocusFlow's Expo project:

```bash
pnpm --filter @workspace/focusflow run dev
```

Run the FocusFlow type check:

```bash
pnpm --filter @workspace/focusflow run typecheck
```

## Making changes

- Keep changes focused and preserve the existing project structure.
- Prefer relative URLs and existing workspace conventions.
- Do not silently weaken app-blocking, permission, password, or system-control
  protections.
- Update user-facing documentation or the in-app changelog when a change
  affects users.
- Add or update tests when behavior can be tested automatically.
- Keep generated files and unrelated formatting changes out of the pull
  request.

## Pull requests

Please use the pull request template. A good pull request:

- Explains the user problem and the proposed solution.
- Describes how the change was tested.
- Calls out Android-version or device-specific behavior.
- Includes screenshots or recordings for visible UI changes.
- Notes any required migration, permission, secret, or configuration step.

Maintainers may ask for changes before merging. By contributing, you agree
that your contribution will be licensed under the terms that apply to this
repository.