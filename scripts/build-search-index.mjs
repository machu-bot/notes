#!/usr/bin/env node
/**
 * Build a search index for client-side fuzzy search.
 *
 * Reads all .md files under src/content/posts/, extracts title, labels,
 * createdAt, and a plain-text excerpt of the body, and writes the result
 * to dist/search-index.json so the browser can fetch and search it.
 *
 * Run after `astro build` (or just before, so the file ends up in dist
 * via Astro's static asset handling — we copy it manually).
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const POSTS_DIR = join(ROOT, 'src', 'content', 'posts');
const DIST_DIR = join(ROOT, 'dist');

function stripFrontmatter(md) {
  return md.replace(/^---[\s\S]*?\n---\n/, '');
}

function plainText(md) {
  return md
    // fenced code
    .replace(/```[\s\S]*?```/g, ' ')
    // inline code
    .replace(/`[^`]*`/g, ' ')
    // images / links — keep link text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    // headings / emphasis / blockquote markers
    .replace(/^#+\s+/gm, '')
    .replace(/[*_>~]/g, ' ')
    // list markers
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseFrontmatter(md) {
  const m = md.match(/^---([\s\S]*?)\n---\n/);
  if (!m) return {};
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) continue;
    const [, key, raw] = kv;
    if (raw.startsWith('[') && raw.endsWith(']')) {
      try {
        fm[key] = JSON.parse(raw);
      } catch {
        fm[key] = raw;
      }
    } else if (raw.startsWith('"') && raw.endsWith('"')) {
      fm[key] = JSON.parse(raw);
    } else if (raw === 'true' || raw === 'false' || !isNaN(Number(raw))) {
      fm[key] = JSON.parse(raw);
    } else {
      fm[key] = raw;
    }
  }
  return fm;
}

if (!existsSync(POSTS_DIR)) {
  console.error('No posts directory — nothing to index.');
  process.exit(0);
}

const files = readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md'));
const EXCERPT_LEN = 2000; // first ~2KB of plain text per post

const entries = files.map((f) => {
  const raw = readFileSync(join(POSTS_DIR, f), 'utf8');
  const fm = parseFrontmatter(raw);
  const body = stripFrontmatter(raw);
  const text = plainText(body);
  return {
    id: f.replace(/\.md$/, ''),
    title: fm.title || '',
    issue: fm.issue || 0,
    createdAt: fm.createdAt || '',
    labels: fm.labels || [],
    excerpt: text.slice(0, EXCERPT_LEN),
  };
});

entries.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

if (!existsSync(DIST_DIR)) mkdirSync(DIST_DIR, { recursive: true });
const out = join(DIST_DIR, 'search-index.json');
writeFileSync(out, JSON.stringify(entries), 'utf8');
console.log(`✔ Wrote ${entries.length} entries → dist/search-index.json (${(JSON.stringify(entries).length / 1024).toFixed(1)} KB)`);
