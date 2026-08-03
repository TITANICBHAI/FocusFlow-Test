import { readFileSync, readdirSync } from 'fs';
import { join, relative } from 'path';
import { execSync } from 'child_process';

const TOKEN =
  process.env.GITHUB_PERSONAL_ACCESS_TOKEN ||
  process.env.GITHUB_PAT ||
  process.env.GH_PAT ||
  process.env.PAT;
const OWNER = 'TITANICBHAI';
const REPO = 'FocusFlow';
const BRANCH = 'gh-pages';
const DIST_DIR = '/home/runner/workspace/artifacts/focusflow-feature-videos/dist/public';
const CONCURRENCY = 4;
const MAX_RETRIES = 6;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function ghFetch(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: {
      Authorization: `token ${TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'focusflow-pages-deploy-bot',
      Accept: 'application/vnd.github+json',
    },
  };
  if (body) opts.body = JSON.stringify(body);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const resp = await fetch(`https://api.github.com${path}`, opts);
    const txt = await resp.text();
    if (resp.ok) return JSON.parse(txt);

    const isRateLimited =
      resp.status === 429 ||
      (resp.status === 403 && /rate limit|abuse|secondary/i.test(txt));
    const isServerError = resp.status === 502 || resp.status === 503 || resp.status === 504;

    if ((isRateLimited || isServerError) && attempt < MAX_RETRIES) {
      const retryAfter = parseInt(resp.headers.get('retry-after') || '0', 10);
      const backoffMs = isServerError
        ? Math.min(10_000, 1_000 * (attempt + 1))
        : retryAfter > 0 ? retryAfter * 1000 : Math.min(60_000, 1000 * 2 ** attempt);
      console.warn(`  Retrying (${resp.status}) in ${Math.round(backoffMs / 1000)}s… (attempt ${attempt + 1}/${MAX_RETRIES})`);
      await sleep(backoffMs);
      continue;
    }
    if (resp.status === 404) return null;
    throw new Error(`GitHub ${method} ${path} → ${resp.status}: ${txt.slice(0, 300)}`);
  }
  throw new Error(`GitHub ${method} ${path} → exhausted retries`);
}

function collectFiles(dir, files = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); }
  catch { return files; }
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) collectFiles(fullPath, files);
    else files.push(fullPath);
  }
  return files;
}

async function createBlob(content, encoding) {
  const data = await ghFetch(`/repos/${OWNER}/${REPO}/git/blobs`, 'POST', { content, encoding });
  return data.sha;
}

async function processInBatches(items, concurrency, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
    if (i % 20 === 0) console.log(`  Processed ${Math.min(i + concurrency, items.length)}/${items.length}`);
  }
  return results;
}

async function ensureGhPagesBranch() {
  const ref = await ghFetch(`/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`);
  if (ref) {
    console.log(`Branch '${BRANCH}' exists.`);
    return ref.object.sha;
  }
  console.log(`Branch '${BRANCH}' not found — creating orphan branch...`);
  const mainRef = await ghFetch(`/repos/${OWNER}/${REPO}/git/ref/heads/main`);
  if (!mainRef) throw new Error('Cannot find main branch to base gh-pages on.');
  const emptyTree = await ghFetch(`/repos/${OWNER}/${REPO}/git/trees`, 'POST', { tree: [] });
  const orphanCommit = await ghFetch(`/repos/${OWNER}/${REPO}/git/commits`, 'POST', {
    message: 'chore: initialise gh-pages branch',
    tree: emptyTree.sha,
    parents: [],
  });
  await ghFetch(`/repos/${OWNER}/${REPO}/git/refs`, 'POST', {
    ref: `refs/heads/${BRANCH}`,
    sha: orphanCommit.sha,
  });
  console.log(`Created orphan branch '${BRANCH}'.`);
  return orphanCommit.sha;
}

async function enablePages() {
  console.log('Enabling GitHub Pages on gh-pages branch...');
  try {
    await ghFetch(`/repos/${OWNER}/${REPO}/pages`, 'POST', {
      source: { branch: BRANCH, path: '/' },
    });
    console.log('GitHub Pages enabled.');
  } catch (e) {
    if (/already enabled|409|422/.test(e.message)) {
      console.log('GitHub Pages already enabled — skipping.');
    } else {
      console.warn('Could not enable Pages via API (may need to do it manually):', e.message.slice(0, 100));
    }
  }
}

async function run() {
  if (!TOKEN) {
    throw new Error('Missing GitHub token secret. Add GITHUB_PERSONAL_ACCESS_TOKEN, GITHUB_PAT, GH_PAT, or PAT in Secrets.');
  }

  console.log('Building feature videos for GitHub Pages...');
  execSync(
    'pnpm --filter @workspace/focusflow-feature-videos run build',
    {
      cwd: '/home/runner/workspace',
      stdio: 'inherit',
      env: {
        ...process.env,
        BASE_PATH: '/FocusFlow/',
        NODE_ENV: 'production',
      },
    }
  );
  console.log('Build complete.\n');

  const latestSha = await ensureGhPagesBranch();
  await enablePages();

  console.log('Collecting built files...');
  const allFiles = collectFiles(DIST_DIR);
  console.log(`Found ${allFiles.length} files`);

  const fileMetas = allFiles.map(fp => {
    const rel = relative(DIST_DIR, fp);
    let content, encoding;
    try {
      const buf = readFileSync(fp);
      const isText = !buf.slice(0, 512).includes(0);
      if (isText) { content = buf.toString('utf8'); encoding = 'utf-8'; }
      else { content = buf.toString('base64'); encoding = 'base64'; }
    } catch { return null; }
    return { path: rel, content, encoding };
  }).filter(Boolean);

  console.log(`\nUploading ${fileMetas.length} blobs...`);
  const treeItems = [];
  const failures = [];
  await processInBatches(fileMetas, CONCURRENCY, async (meta) => {
    try {
      const sha = await createBlob(meta.content, meta.encoding);
      treeItems.push({ path: meta.path, mode: '100644', type: 'blob', sha });
    } catch (e) {
      console.warn(`  SKIP: ${meta.path} — ${e.message.slice(0, 100)}`);
      failures.push(meta.path);
    }
  });

  if (failures.length > 0) {
    console.error(`\n${failures.length} file(s) failed — aborting.`);
    process.exit(1);
  }

  // Build a completely fresh tree (no base_tree) so old docs files are wiped out entirely.
  let currentTreeSha = undefined;
  const TREE_CHUNK = 100;
  for (let i = 0; i < treeItems.length; i += TREE_CHUNK) {
    const chunk = treeItems.slice(i, i + TREE_CHUNK);
    const body = { tree: chunk };
    if (currentTreeSha) body.base_tree = currentTreeSha;
    const layered = await ghFetch(`/repos/${OWNER}/${REPO}/git/trees`, 'POST', body);
    currentTreeSha = layered.sha;
    console.log(`  Built ${Math.min(i + TREE_CHUNK, treeItems.length)}/${treeItems.length}`);
  }

  console.log('Committing to gh-pages...');
  const newCommit = await ghFetch(`/repos/${OWNER}/${REPO}/git/commits`, 'POST', {
    message: `deploy: feature videos — ${new Date().toISOString()}`,
    tree: currentTreeSha,
    parents: [latestSha],
  });

  console.log('Updating gh-pages ref...');
  await ghFetch(`/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`, 'PATCH', {
    sha: newCommit.sha,
    force: true,
  });

  console.log('\nSuccess!');
  console.log(`Pages URL: https://${OWNER.toLowerCase()}.github.io/${REPO}/`);
  console.log(`Commit:    ${newCommit.sha.slice(0, 7)}`);
}

run().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
