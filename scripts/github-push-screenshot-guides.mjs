import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const TOKEN =
  process.env.GITHUB_PERSONAL_ACCESS_TOKEN ||
  process.env.GITHUB_PAT ||
  process.env.GH_PAT ||
  process.env.PAT;

const OWNER   = 'TITANICBHAI';
const REPO    = 'FocusFlow-Feature-Videos';
const BRANCH  = 'main';
const GUIDES_DIR = '/home/runner/workspace/artifacts/focusflow-feature-videos/screenshot-guides';
const REPO_PATH  = 'screenshot-guides'; // path inside the repo

const MAX_RETRIES = 4;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function ghFetch(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: {
      Authorization: `token ${TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'focusflow-guides-push-bot',
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
    if (isRateLimited && attempt < MAX_RETRIES) {
      const backoff = Math.min(30_000, 1000 * 2 ** attempt);
      console.warn(`  Rate limited — retrying in ${backoff / 1000}s…`);
      await sleep(backoff);
      continue;
    }
    if (resp.status === 404 || resp.status === 409) return null;
    throw new Error(`GitHub ${method} ${path} → ${resp.status}: ${txt.slice(0, 200)}`);
  }
  throw new Error(`Exhausted retries for ${path}`);
}

async function ensureMainBranch() {
  const ref = await ghFetch(`/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`);
  if (ref) return ref.object.sha;

  console.log(`'${BRANCH}' branch not found — branching from gh-pages…`);
  // gh-pages already exists (created by the deploy script); create main from it
  const ghPagesRef = await ghFetch(`/repos/${OWNER}/${REPO}/git/ref/heads/gh-pages`);
  if (!ghPagesRef) throw new Error('Neither main nor gh-pages exist. Run the deploy script first.');

  const created = await ghFetch(`/repos/${OWNER}/${REPO}/git/refs`, 'POST', {
    ref: `refs/heads/${BRANCH}`,
    sha: ghPagesRef.object.sha,
  });
  if (!created) throw new Error('Failed to create main branch from gh-pages.');
  console.log(`Created '${BRANCH}' at ${ghPagesRef.object.sha.slice(0, 7)}.`);
  return ghPagesRef.object.sha;
}

async function upsertFile(repoFilePath, content) {
  // Check if file already exists (to get its SHA for update)
  const existing = await ghFetch(`/repos/${OWNER}/${REPO}/contents/${repoFilePath}?ref=${BRANCH}`);
  const body = {
    message: `docs: add screenshot guide — ${repoFilePath}`,
    content: Buffer.from(content, 'utf8').toString('base64'),
    branch: BRANCH,
  };
  if (existing?.sha) body.sha = existing.sha;

  await ghFetch(`/repos/${OWNER}/${REPO}/contents/${repoFilePath}`, 'PUT', body);
}

async function run() {
  if (!TOKEN) throw new Error('Missing GitHub token secret.');

  await ensureMainBranch();

  const files = readdirSync(GUIDES_DIR).filter(f => f.endsWith('.md'));
  console.log(`Pushing ${files.length} markdown guides to ${OWNER}/${REPO} (${BRANCH})…`);

  for (const file of files) {
    const localPath  = join(GUIDES_DIR, file);
    const repoPath   = `${REPO_PATH}/${file}`;
    const content    = readFileSync(localPath, 'utf8');
    console.log(`  → ${repoPath}`);
    await upsertFile(repoPath, content);
  }

  console.log('\nDone!');
  console.log(`Guides live at: https://github.com/${OWNER}/${REPO}/tree/${BRANCH}/${REPO_PATH}`);
}

run().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
