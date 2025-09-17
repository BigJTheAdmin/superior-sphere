---
title: "CLI Tricks that Save Hours"
description: "Battle-tested commands for network engineers."
pubDate: 2025-09-16
tags: ["CLI","Guides"]
draft: false
---

```bash
ping -c 5 1.1.1.1
traceroute google.com
ssh -J jumphost user@internal-host

## Drafts vs Published
- `draft: true` → hidden from index and routes in production.
- Flip to `false` to publish.

## Tags
- Just add `tags: ["PaloAlto", "BGP"]`.  
- Your index already reads them; you can later add tag filtering if you want.

## Images / hero
- Put images in `/public/blog/` and reference with `/blog/filename.jpg`.
- If you omit `heroImage`, the card just shows text.

---

# (Nice to have) A one-command post generator

If you want a quick “new post” command, add this small script.

**File:** `tools/new-post.mjs`
```js
// Node 18+.
// Usage: node tools/new-post.mjs "My Post Title" [--draft]
import { writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node tools/new-post.mjs \"My Post Title\" [--draft]");
  process.exit(1);
}
const title = args.find(a => !a.startsWith("--"));
const isDraft = args.includes("--draft");

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}
const slug = slugify(title);
const today = new Date();
const yyyy = today.getFullYear();
const mm = String(today.getMonth() + 1).padStart(2, "0");
const dd = String(today.getDate()).padStart(2, "0");
const dateISO = `${yyyy}-${mm}-${dd}`;

const dir = resolve("src/content/post");
const file = resolve(dir, `${slug}.md`);

const tpl = `---
title: "${title.replace(/"/g,'\\"')}"
description: ""
pubDate: ${dateISO}
author: "Javon"
tags: []
heroImage: 
draft: ${isDraft ? "true" : "false"}
---

Write your post here.
`;

await mkdir(dir, { recursive: true });
await writeFile(file, tpl, { flag: "wx" }).catch(async (e) => {
  if (e.code === "EEXIST") {
    console.error("File already exists:", file);
    process.exit(1);
  }
  throw e;
});
console.log("Created:", file);

node tools/new-post.mjs "Release Notes: v0.1.0"
# or draft
node tools/new-post.mjs "Roadmap Q4" --draft
