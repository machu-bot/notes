---
title: "Hello, world"
issue: 1
createdAt: 2026-06-16T00:00:00.000Z
updatedAt: 2026-06-16T00:00:00.000Z
labels: ["published", "intro"]
---

# Welcome to notes

This blog is backed by **GitHub Issues**.

## How it works

1. Open an issue in [machu-bot/notes](https://github.com/machu-bot/notes/issues)
2. Add the `published` label
3. A GitHub Action fetches it, converts it to a markdown post, and deploys

That's it. No CMS, no database — just `gh issue create`.

```js
const note = 'simple';
console.log(note);
```

> Quotes work too.
