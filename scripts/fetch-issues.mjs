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

// Use gh's -f (field) flags for query parameters to dodge shell `?` glob
// expansion under /bin/sh on GitHub-hosted runners. Pass labels as the array
// form so it's serialised as repeated `labels[]=` keys.
// The Issues list API wants `labels=foo,bar` (a single comma-separated
// value), not the `labels[]=foo labels[]=bar` array form used by PR/issue
// creation endpoints. Pass it through `-f` so it's still URL-encoded safely
// (no `?` to break under /bin/sh on the runner).
const labelsArg = `-f labels=${(process.env.ISSUE_LABEL || 'published').split(',').join(',')}`;

// `gh api /path` defaults to POST when no method flag is given, so we have
// to be explicit. We also avoid `?` in the path because `/bin/sh` (dash) on
// the GitHub-hosted runner expands it as a glob character.
const cmd = `gh api -X GET repos/${REPO}/issues ${labelsArg} -f state=all -f per_page=100 -f sort=created -f direction=desc --paginate --slurp`;
const raw = execSync(cmd, {
  encoding: 'utf8',
  maxBuffer: 256 * 1024 * 1024,
}).trim();

// `gh api ... --paginate --slurp` wraps every page in its own array and
// concatenates them: `[[p1], [p2], ...]`. Flatten one level to recover the
// full issue list.
const pages = JSON.parse(raw);
const issues = pages.flat();

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
