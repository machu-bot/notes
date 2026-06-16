# notes

Personal learning log. Backed by [GitHub Issues](https://github.com/machu-bot/notes/issues).

## How it works

Open an issue → add the `published` label → a GitHub Action fetches it, converts the body to a post, and redeploys to GitHub Pages.

- All posts live as issues in this repo
- The `published` label gates what gets built
- The `fetch-issues.mjs` script converts issues to markdown with frontmatter
- Astro renders the static site; Nothing v3 design tokens

## Stack

- [Astro 6](https://astro.build) — static site
- GitHub Actions — issue fetcher + build + Pages deploy
- Nothing v3 — visual design (Doto / Space Grotesk / Space Mono)
