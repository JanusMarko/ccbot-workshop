---
title: Wiki
description: In-app documentation wiki
order: 7
---

# Wiki

CCWeb includes a built-in documentation wiki that renders the markdown files from the `docs/` directory directly in the app.

## Accessing the Wiki

Click **"Wiki / Help"** at the bottom of the session sidebar. This switches the entire view to wiki mode with a navigation sidebar and content area.

## Navigation

- **Sidebar** — shows all documentation pages organized by section (Getting Started, Features, Architecture, Troubleshooting)
- **Breadcrumbs** — shows your current location at the top of each page
- **Internal links** — links between doc pages work as in-app navigation
- **Back button** — returns to the session view

## Search

Type in the search box at the top of the wiki sidebar. Results appear in real-time with snippets showing where the match was found. Click a result to navigate to that page.

## Writing Documentation

Doc files live in `ccweb/docs/` as standard markdown with YAML frontmatter:

```markdown
---
title: Page Title
description: Brief description
order: 1
---

# Page Title

Content here...
```

- `title` — displayed in the sidebar and breadcrumbs
- `description` — used for search results
- `order` — controls sorting within each section (lower = earlier)

Internal links use relative paths: `[Sessions](../features/sessions.md)`

These links work both in the in-app wiki AND when browsing the files on GitHub.
