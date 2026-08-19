---
name: Frozen pnpm installs behind the package firewall
description: Replit imports can fail to link a frozen pnpm workspace when the firewall blocks a transitive tarball.
---

When a frozen pnpm install reports a 403 from the package firewall, do not change the project manifests just to work around it. Clear the injected registry environment variables for the one install command and set `--config.registry=https://registry.npmjs.org`; the lockfile remains authoritative and the existing dependency set can link normally.

**Why:** The workspace package manager configuration and injected `npm_config_registry` variables can override a per-command registry override unless they are removed from the environment first.

**How to apply:** Use `env -u npm_config_registry -u NPM_CONFIG_REGISTRY pnpm install --frozen-lockfile ... --config.registry=https://registry.npmjs.org`, then verify `package.json` and `pnpm-lock.yaml` are unchanged.