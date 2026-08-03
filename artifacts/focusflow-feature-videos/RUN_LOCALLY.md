# Running FocusFlow Feature Videos Locally

## Exact versions used

| Tool | Version |
|------|---------|
| Node.js | **v20.20.0** |
| pnpm | **10.26.1** |

## Prerequisites

**1. Install Node.js v20.20.0**
Download from https://nodejs.org/en/download — pick **v20.20.0** (or any v20 LTS).
On Windows, run the `.msi` installer and follow the prompts. Restart your terminal after.

Verify it worked:
```
node --version
```
Expected output: `v20.20.0`

**2. Install pnpm 10.26.1**
```
npm install -g pnpm@10.26.1
```

Verify:
```
pnpm --version
```
Expected output: `10.26.1`

## Steps

**3. Clone the repo**
```
git clone https://github.com/TITANICBHAI/FocusFlow.git
cd FocusFlow
```

**4. Install all dependencies**
```
pnpm install
```
This installs packages for the entire monorepo. Takes about a minute the first time.

**5. Start the feature videos app**
```
pnpm --filter @workspace/focusflow-feature-videos run dev
```

**6. Open in browser**
```
http://localhost:6000
```

The app hot-reloads on save — any edits you make show up instantly.

## Building a static version (optional)

If you want a self-contained build you can open from a file or host anywhere:
```
pnpm --filter @workspace/focusflow-feature-videos run build
```
Output goes to `artifacts/focusflow-feature-videos/dist/public/`.

Serve it locally with:
```
npx serve artifacts/focusflow-feature-videos/dist/public
```
Then open http://localhost:3000
