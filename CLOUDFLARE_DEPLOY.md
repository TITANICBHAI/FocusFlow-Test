# Deploying FocusFlow Website to Cloudflare Pages

This guide walks you through hosting the FocusFlow marketing site (the `mockup-sandbox` Vite app) on Cloudflare Pages — free, global CDN, automatic HTTPS.

---

## Prerequisites

- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier is enough)
- The `TITANICBHAI/FocusFlow` GitHub repository (already synced via the Push to GitHub workflow)

---

## Step 1 — Connect GitHub to Cloudflare Pages

1. Log in to [dash.cloudflare.com](https://dash.cloudflare.com)
2. In the left sidebar click **Workers & Pages**
3. Click **Create** → **Pages** → **Connect to Git**
4. Authorize Cloudflare to access your GitHub account
5. Select the repository: **TITANICBHAI/FocusFlow**
6. Click **Begin setup**

---

## Step 2 — Configure the Build

Fill in the build settings exactly as shown:

| Setting | Value |
|---|---|
| **Framework preset** | None (leave blank) |
| **Build command** | `cd artifacts/mockup-sandbox && npm install -g pnpm && pnpm install && PORT=4173 BASE_PATH=/ pnpm run build` |
| **Build output directory** | `artifacts/mockup-sandbox/dist` |
| **Root directory** | `/` (leave as repo root) |

### Environment Variables (click "Add variable" for each)

| Variable | Value |
|---|---|
| `PORT` | `4173` |
| `BASE_PATH` | `/` |
| `NODE_VERSION` | `20` |

> Cloudflare Pages uses Node 18 by default. Setting `NODE_VERSION=20` ensures compatibility with the Vite 7 + ESM build.

Click **Save and Deploy**.

---

## Step 3 — Fix Client-Side Routing (SPA fallback)

Because the site is a React SPA with routes like `/privacy` and `/terms`, Cloudflare needs to be told to serve `index.html` for all paths. This is done via a `_redirects` file.

The file already exists at:

```
artifacts/mockup-sandbox/public/_redirects
```

If it does not exist, create it with this single line:

```
/* /index.html 200
```

The `public/` folder is copied into `dist/` by Vite automatically, so Cloudflare will pick it up.

---

## Step 4 — Custom Domain (Optional)

Once deployed, Cloudflare gives you a free subdomain like:
`focusflow-tbtechs.pages.dev`

To use a custom domain (e.g. `focusflow.app`):

1. Go to your Pages project → **Custom domains** → **Set up a custom domain**
2. Enter your domain
3. Cloudflare will walk you through adding a CNAME record
4. HTTPS is provisioned automatically — no certificate setup needed

---

## Step 5 — Update Canonical URL

Once you have your final domain, update the canonical and Open Graph URLs in `artifacts/mockup-sandbox/index.html`:

```html
<link rel="canonical" href="https://YOUR-DOMAIN.com/" />
<meta property="og:url" content="https://YOUR-DOMAIN.com/" />
```

And update `artifacts/mockup-sandbox/public/sitemap.xml` to use the same domain:

```xml
<loc>https://YOUR-DOMAIN.com/</loc>
<loc>https://YOUR-DOMAIN.com/privacy</loc>
<loc>https://YOUR-DOMAIN.com/terms</loc>
```

Push those changes via the **Push to GitHub** workflow and Cloudflare will auto-redeploy.

---

## Step 6 — Submit to Google Search Console

1. Go to [search.google.com/search-console](https://search.google.com/search-console)
2. Add your property (URL prefix: `https://YOUR-DOMAIN.com/`)
3. Verify ownership via the HTML tag method (add the `<meta name="google-site-verification" ...>` tag to `index.html`)
4. Submit your sitemap: `https://YOUR-DOMAIN.com/sitemap.xml`

---

## Automatic Redeploys

Every time you run the **Push to GitHub** workflow from Replit, Cloudflare Pages automatically detects the new commit and redeploys within ~60 seconds. No manual action needed.

---

## Summary of Files Relevant to Deployment

| File | Purpose |
|---|---|
| `artifacts/mockup-sandbox/index.html` | All meta tags, JSON-LD schemas, static SEO content |
| `artifacts/mockup-sandbox/public/robots.txt` | Search engine and AI bot crawl rules |
| `artifacts/mockup-sandbox/public/sitemap.xml` | Page index for Google and AI crawlers |
| `artifacts/mockup-sandbox/public/_redirects` | Cloudflare SPA fallback (create if missing) |
| `artifacts/mockup-sandbox/src/components/FocusFlowLanding.tsx` | Main landing page |
| `artifacts/mockup-sandbox/src/components/PrivacyPolicy.tsx` | Privacy policy page (`/privacy`) |
| `artifacts/mockup-sandbox/src/components/TermsOfService.tsx` | Terms of service page (`/terms`) |
