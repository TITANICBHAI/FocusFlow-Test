import { readFileSync, readdirSync } from 'fs';
import { join, relative } from 'path';
import { execSync } from 'child_process';

const TOKEN =
  process.env.GITHUB_PERSONAL_ACCESS_TOKEN ||
  process.env.GITHUB_PAT ||
  process.env.GH_PAT ||
  process.env.PAT;

const OWNER  = 'TITANICBHAI';
const REPO   = 'FocusFlow-Feature-Videos';
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
      'User-Agent': 'focusflow-feature-videos-deploy-bot',
      Accept: 'application/vnd.github+json',
    },
  };
  if (body) opts.body = JSON.stringify(body);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const resp = await fetch(`https://api.github.com${path}`, opts);
    const txt  = await resp.text();
    if (resp.ok) return JSON.parse(txt);

    const isRateLimited =
      resp.status === 429 ||
      (resp.status === 403 && /rate limit|abuse|secondary/i.test(txt));
    const isServerError =
      resp.status === 502 || resp.status === 503 || resp.status === 504;

    if ((isRateLimited || isServerError) && attempt < MAX_RETRIES) {
      const retryAfter = parseInt(resp.headers.get('retry-after') || '0', 10);
      const backoffMs  = isServerError
        ? Math.min(10_000, 1_000 * (attempt + 1))
        : retryAfter > 0 ? retryAfter * 1000 : Math.min(60_000, 1000 * 2 ** attempt);
      console.warn(`  Retrying (${resp.status}) in ${Math.round(backoffMs / 1000)}s… (attempt ${attempt + 1}/${MAX_RETRIES})`);
      await sleep(backoffMs);
      continue;
    }
    if (resp.status === 404 || resp.status === 409) return null;
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

async function ensureRepo() {
  console.log(`Checking if repo ${OWNER}/${REPO} exists...`);
  const existing = await ghFetch(`/repos/${OWNER}/${REPO}`);
  if (existing) {
    console.log('Repo already exists.');
    return;
  }
  console.log(`Creating repo ${REPO}...`);
  await ghFetch('/user/repos', 'POST', {
    name: REPO,
    description: 'FocusFlow feature video — interactive web showcase',
    homepage: `https://${OWNER.toLowerCase()}.github.io/${REPO}/`,
    private: false,
    auto_init: false,
  });
  console.log('Repo created.');
}

async function ensureGhPagesBranch() {
  const ref = await ghFetch(`/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`);
  if (ref) {
    console.log(`Branch '${BRANCH}' exists.`);
    return ref.object.sha;
  }

  console.log(`Branch '${BRANCH}' not found — seeding via Contents API...`);

  // The git low-level API (/git/blobs, /git/trees) won't work on a repo that has
  // never had a commit.  The Contents API (PUT /contents/…) is the only endpoint
  // that bootstraps a completely empty repo AND lets us choose the target branch.
  const seed = await ghFetch(`/repos/${OWNER}/${REPO}/contents/.nojekyll`, 'PUT', {
    message: 'chore: initialise gh-pages branch',
    content: '',          // empty file; GitHub accepts empty base64 for 0-byte files
    branch: BRANCH,
  });
  if (!seed || !seed.commit) {
    throw new Error('Failed to seed gh-pages branch via Contents API. Check token permissions (repo scope required).');
  }

  console.log(`Created branch '${BRANCH}' with seed commit ${seed.commit.sha.slice(0, 7)}.`);
  return seed.commit.sha;
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
      console.warn('Could not enable Pages via API:', e.message.slice(0, 120));
    }
  }
}

async function run() {
  if (!TOKEN) {
    throw new Error(
      'Missing GitHub token secret. Add GITHUB_PERSONAL_ACCESS_TOKEN, GITHUB_PAT, GH_PAT, or PAT in Secrets.'
    );
  }

  await ensureRepo();

  console.log('\nBuilding feature videos...');
  execSync(
    'pnpm --filter @workspace/focusflow-feature-videos run build',
    {
      cwd: '/home/runner/workspace',
      stdio: 'inherit',
      env: {
        ...process.env,
        BASE_PATH: `/${REPO}/`,
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
      else         { content = buf.toString('base64'); encoding = 'base64'; }
    } catch { return null; }
    return { path: rel, content, encoding };
  }).filter(Boolean);

  console.log(`\nCreating ${fileMetas.length} blobs...`);
  const treeItems = [];
  const failures  = [];

  for (let i = 0; i < fileMetas.length; i += CONCURRENCY) {
    const batch = fileMetas.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (meta) => {
      try {
        const data = await ghFetch(`/repos/${OWNER}/${REPO}/git/blobs`, 'POST', {
          content: meta.content,
          encoding: meta.encoding,
        });
        treeItems.push({ path: meta.path, mode: '100644', type: 'blob', sha: data.sha });
      } catch (e) {
        console.warn(`  SKIP: ${meta.path} — ${e.message.slice(0, 80)}`);
        failures.push(meta.path);
      }
    }));
    if (i % 20 === 0) {
      console.log(`  Processed ${Math.min(i + CONCURRENCY, fileMetas.length)}/${fileMetas.length}`);
    }
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} file(s) failed — aborting.`);
    process.exit(1);
  }

  let currentTreeSha;
  const TREE_CHUNK = 100;
  for (let i = 0; i < treeItems.length; i += TREE_CHUNK) {
    const chunk = treeItems.slice(i, i + TREE_CHUNK);
    const body  = { tree: chunk };
    if (currentTreeSha) body.base_tree = currentTreeSha;
    const layered = await ghFetch(`/repos/${OWNER}/${REPO}/git/trees`, 'POST', body);
    currentTreeSha = layered.sha;
    console.log(`  Layered ${Math.min(i + TREE_CHUNK, treeItems.length)}/${treeItems.length}`);
  }

  console.log('Committing...');
  const newCommit = await ghFetch(`/repos/${OWNER}/${REPO}/git/commits`, 'POST', {
    message: `deploy: feature videos — ${new Date().toISOString()}`,
    tree: currentTreeSha,
    parents: [latestSha],
  });

  console.log('Updating branch ref...');
  await ghFetch(`/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`, 'PATCH', {
    sha: newCommit.sha,
    force: true,
  });

  console.log('\nSuccess!');
  console.log(`Repo:      https://github.com/${OWNER}/${REPO}`);
  console.log(`Pages URL: https://${OWNER.toLowerCase()}.github.io/${REPO}/`);
  console.log(`Commit:    ${newCommit.sha.slice(0, 7)}`);
}

run().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
