import { readFileSync, readdirSync } from 'fs';
import { join, relative } from 'path';

const TOKEN =
  process.env.GITHUB_PERSONAL_ACCESS_TOKEN ||
  process.env.GITHUB_PAT ||
  process.env.GH_PAT ||
  process.env.PAT;
const OWNER = 'TITANICBHAI';
const REPO = 'FocusFlow';
const BRANCH = 'main';
const BASE = '/home/runner/workspace';
// GitHub's secondary rate limit triggers around ~10 parallel POSTs to /git/blobs.
// Keep concurrency low and rely on retries to absorb the occasional 403/429.
const CONCURRENCY = 4;
const MAX_RETRIES = 6;

const EXCLUDE_PATTERNS = [
  /node_modules/,
  /\/android\//,
  /\.cache\//,
  /\.local\//,
  /\.expo/,
  /\/dist\//,
  /\/tmp\//,
  /\/out-tsc\//,
  /\.git\//,
  /\.keystore$/,
  /\.jks$/,
  /credentials\.json$/,
  /\.DS_Store$/,
  /Thumbs\.db$/,
  /\.tsbuildinfo$/,
  /tbtechs-release\.keystore/,
];

const MUST_INCLUDE_PATTERNS = [
  /^artifacts\/focusflow\/android-native\//,
];

function shouldExclude(filePath) {
  const rel = relative(BASE, filePath);
  if (MUST_INCLUDE_PATTERNS.some(p => p.test(rel))) return false;
  return EXCLUDE_PATTERNS.some(p => p.test(rel) || p.test(filePath));
}

function collectFiles(dir, files = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); }
  catch { return files; }
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (shouldExclude(fullPath)) continue;
    if (entry.isDirectory()) collectFiles(fullPath, files);
    else files.push(fullPath);
  }
  return files;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function ghFetch(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: {
      Authorization: `token ${TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'focusflow-push-bot',
      Accept: 'application/vnd.github+json',
    },
  };
  if (body) opts.body = JSON.stringify(body);

  // Retry on secondary rate limit (403) and primary rate limit (429).
  // GitHub's body for these contains "secondary rate limit" / "abuse" / "rate limit".
  // We honor Retry-After when present; otherwise exponential backoff.
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
    throw new Error(`GitHub ${method} ${path} → ${resp.status}: ${txt.slice(0, 200)}`);
  }
  throw new Error(`GitHub ${method} ${path} → exhausted retries`);
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
    if (i % 50 === 0) console.log(`  Processed ${Math.min(i + concurrency, items.length)}/${items.length}`);
  }
  return results;
}

function getAppVersion() {
  try {
    const appJson = JSON.parse(readFileSync('/home/runner/workspace/artifacts/focusflow/app.json', 'utf-8'));
    const version = appJson?.expo?.version ?? 'unknown';
    const versionCode = appJson?.expo?.android?.versionCode ?? '?';
    return { version, versionCode };
  } catch {
    return { version: 'unknown', versionCode: '?' };
  }
}

async function run() {
  if (!TOKEN) {
    throw new Error('Missing GitHub token secret. Add GITHUB_PERSONAL_ACCESS_TOKEN, GITHUB_PAT, GH_PAT, or PAT in Secrets.');
  }

  const { version, versionCode } = getAppVersion();
  console.log(`Pushing FocusFlow → https://github.com/${OWNER}/${REPO}`);
  console.log(`Branch:      ${BRANCH}`);
  console.log(`Version:     v${version}`);
  console.log(`versionCode: ${versionCode}\n`);

  console.log('Collecting files...');
  const allFiles = collectFiles(BASE);
  console.log(`Found ${allFiles.length} files`);

  const fileMetas = allFiles.map(fp => {
    const rel = relative(BASE, fp);
    let content, encoding;
    try {
      const buf = readFileSync(fp);
      const isText = !buf.slice(0, 512).includes(0);
      if (isText) { content = buf.toString('utf8'); encoding = 'utf-8'; }
      else { content = buf.toString('base64'); encoding = 'base64'; }
    } catch { return null; }
    return { path: rel, content, encoding };
  }).filter(Boolean);

  console.log(`\nCreating ${fileMetas.length} blobs in parallel (batch size ${CONCURRENCY})...`);

  const treeItems = [];
  const failures = [];
  await processInBatches(fileMetas, CONCURRENCY, async (meta) => {
    try {
      const sha = await createBlob(meta.content, meta.encoding);
      treeItems.push({ path: meta.path, mode: '100644', type: 'blob', sha });
    } catch (e) {
      console.warn(`  SKIP: ${meta.path} — ${e.message.slice(0, 200)}`);
      failures.push({ path: meta.path, message: e.message });
    }
  });

  if (failures.length > 0) {
    console.error(`\n${failures.length} file(s) failed to upload after retries — aborting to avoid pushing a half-broken tree:`);
    for (const f of failures.slice(0, 20)) console.error(`  - ${f.path}`);
    if (failures.length > 20) console.error(`  ... and ${failures.length - 20} more`);
    process.exit(1);
  }

  console.log(`\nGetting current branch ref...`);
  const refData = await ghFetch(`/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`);
  const latestSha = refData.object.sha;
  console.log('Base commit:', latestSha);

  // GitHub's tree API times out on huge replacement trees (~400+ entries).
  // Build the tree incrementally in chunks, each layered on top of the
  // previous tree via base_tree. We start from the existing branch tree so
  // unchanged files (e.g. files we excluded) stay intact.
  const baseCommit = await ghFetch(`/repos/${OWNER}/${REPO}/git/commits/${latestSha}`);
  let currentTreeSha = baseCommit.tree.sha;
  const TREE_CHUNK = 100;
  console.log(`Layering ${treeItems.length} entries in chunks of ${TREE_CHUNK}...`);
  for (let i = 0; i < treeItems.length; i += TREE_CHUNK) {
    const chunk = treeItems.slice(i, i + TREE_CHUNK);
    const layered = await ghFetch(`/repos/${OWNER}/${REPO}/git/trees`, 'POST', {
      base_tree: currentTreeSha,
      tree: chunk,
    });
    currentTreeSha = layered.sha;
    console.log(`  Layered ${Math.min(i + TREE_CHUNK, treeItems.length)}/${treeItems.length}`);
  }
  const newTree = { sha: currentTreeSha };

  console.log('Committing...');
  const newCommit = await ghFetch(`/repos/${OWNER}/${REPO}/git/commits`, 'POST', {
    message: `chore: sync Replit workspace — v${version} (versionCode ${versionCode}) — ${new Date().toISOString()}`,
    tree: newTree.sha,
    parents: [latestSha],
  });

  console.log('Updating branch ref...');
  await ghFetch(`/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`, 'PATCH', {
    sha: newCommit.sha,
    force: false,
  });

  console.log('\nSuccess!');
  console.log(`Repo:  https://github.com/${OWNER}/${REPO}`);
}

run().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
