#!/usr/bin/env node
/**
 * Fetch all issues labeled "published" from the current repo
 * and write each one to src/content/posts/<issue-number>-<slug>.md
 *
 * Body markdown is preserved as-is (GitHub already renders it).
 *
 * Run via:  node scripts/fetch-issues.mjs
 * Env:      GH_TOKEN  (set automatically by Actions)
 *           REPO      (set automatically by Actions; format: owner/name)
 */
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const POSTS_DIR = join(__dirname, '..', 'src', 'content', 'posts');

const REPO = process.env.REPO || 'machu-bot/notes';
const LABEL = process.env.ISSUE_LABEL || 'published';

function slugify(text) {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^\p{Letter}\p{Number}\s-]+/gu, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 60) || 'untitled'
  );
}

console.log(`▶ Fetching issues with label "${LABEL}" from ${REPO}…`);

// `gh api --paginate` returns concatenated JSON arrays. The `gh` CLI inserts
// a newline between pages, so each line is a complete JSON array. Join them
// flat into one big array.
const raw = execSync(
  `gh api repos/${REPO}/issues?labels=${encodeURIComponent(LABEL)}&state=all&per_page=100&sort=created&direction=desc --paginate --slurp`,
  { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }
).trim();

let issues = [];
try {
  issues = JSON.parse(raw);
} catch (err) {
  console.error('Failed to parse gh api output. First 500 chars:');
  console.error(raw.slice(0, 500));
  throw err;
}

// /issues returns PRs too — drop them.
const posts = issues.filter((i) => !i.pull_request);

if (!existsSync(POSTS_DIR)) mkdirSync(POSTS_DIR, { recursive: true });

// Wipe stale generated files (only files we previously wrote — pattern `NNN-*.md`).
for (const f of readdirSync(POSTS_DIR)) {
  if (/^\d+-.*\.md$/.test(f)) rmSync(join(POSTS_DIR, f));
}

let written = 0;
for (const issue of posts) {
  const slug = slugify(issue.title);
  const filename = `${issue.number}-${slug}.md`;
  const path = join(POSTS_DIR, filename);

  const labels = (issue.labels || []).map((l) => l.name);
  const fm = [
    '---',
    `title: ${JSON.stringify(issue.title)}`,
    `issue: ${issue.number}`,
    `createdAt: ${issue.created_at}`,
    `updatedAt: ${issue.updated_at}`,
    `labels: ${JSON.stringify(labels)}`,
    '---',
    '',
    issue.body && issue.body.trim().length > 0 ? issue.body : '_(no content)_',
    '',
  ].join('\n');

  writeFileSync(path, fm, 'utf8');
  written++;
}

console.log(`✔ Wrote ${written} post${written === 1 ? '' : 's'} to src/content/posts/`);
