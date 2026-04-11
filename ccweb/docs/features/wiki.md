---
title: Wiki
description: In-app documentation wiki — browsing, searching, and writing docs
order: 7
---

# Wiki

CCWeb includes a built-in documentation wiki that renders the markdown files from the `docs/` directory directly in the app. The same files are readable on GitHub or in any markdown viewer — there's a single source of truth with no content duplication.

## Accessing the Wiki

Click **"Wiki / Help"** at the bottom of the session sidebar. This switches the entire view to wiki mode:
- The session sidebar is replaced by the wiki navigation sidebar
- The message stream is replaced by the documentation page
- The input area and status bar are hidden

Click **"Back"** in the wiki sidebar to return to the session view. Your session state (messages, active session, etc.) is preserved while you're in the wiki.

## Navigation

### Sidebar

The wiki sidebar shows all documentation pages organized into sections:
- **Getting Started** — installation, setup, quickstart
- **Features** — one page per feature
- **Configuration** — environment variables, preferences
- **Architecture** — system design, protocol, history
- **Troubleshooting** — common issues

Click any page to view it. The active page is highlighted with a blue accent border.

### Breadcrumbs

Each page shows breadcrumb navigation at the top: **Wiki / Section / Page**. Click any breadcrumb to navigate up.

### Internal Links

Links between doc pages (like `[Sessions](../features/sessions.md)`) work as in-app navigation — clicking them loads the target page within the wiki, rather than opening a new browser tab. External links (starting with `http`) open in a new tab.

## Search

Type in the search box at the top of the wiki sidebar. Search is debounced (300ms) — results appear after you stop typing. Each result shows the page title and a snippet with the matching text highlighted in context.

Search queries the `GET /api/docs-search?q=` endpoint, which does case-insensitive full-text search across all markdown files in the `docs/` directory.

Click a search result to navigate to that page. The search box clears when you navigate.

## Responsive Behavior

On tablet (screen width ≤1024px), the wiki sidebar becomes a slide-out drawer, same as the session sidebar:
- Tap the hamburger button (top-left) to open
- Navigate to a page → drawer auto-closes
- Swipe left to close

## How It Works (Backend)

Three backend endpoints power the wiki:

### `GET /api/docs`

Returns the complete documentation tree — all `.md` files under `docs/`, with parsed frontmatter metadata:

```json
[
  {
    "path": "features/sessions.md",
    "title": "Sessions",
    "description": "Creating, switching, and managing sessions",
    "order": 1,
    "section": "features"
  }
]
```

The frontend groups entries by `section` and sorts by `order` within each section.

### `GET /api/docs/{path}`

Returns the raw markdown content of a specific file, with YAML frontmatter stripped. The path is validated against the `docs/` directory using `Path.is_relative_to()` to prevent path traversal.

### `GET /api/docs-search?q=`

Searches all `.md` files for the query string (case-insensitive). Returns matching file paths, titles, and text snippets showing the match in context.

## Writing Documentation

### File Format

Doc files are standard markdown with YAML frontmatter:

```markdown
---
title: Page Title
description: Brief description for search results
order: 1
---

# Page Title

Content here. Use standard markdown: headers, lists, code blocks, tables, links.
```

### Frontmatter Fields

| Field | Required | Purpose |
|-------|----------|---------|
| `title` | Yes | Displayed in sidebar, breadcrumbs, search results |
| `description` | No | Shown in search result snippets |
| `order` | No | Sort order within section (lower = earlier, default: 99) |

### Internal Links

Use relative paths: `[Sessions](../features/sessions.md)`

These links work in both contexts:
- **In the wiki** — resolved to in-app navigation (no page reload)
- **On GitHub** — resolved as normal relative file links

### Directory Structure

The directory name becomes the section label in the sidebar:

```
docs/
├── getting-started/    → "Getting Started" section
├── features/           → "Features" section
├── configuration/      → "Configuration" section
├── architecture/       → "Architecture" section
└── troubleshooting/    → "Troubleshooting" section
```

Files directly in `docs/` (like `index.md`, `overview.md`) appear at the top level with no section header.

### Keeping Docs Updated

The project's `CLAUDE.md` contains this instruction:

> **When you change any feature, endpoint, component, protocol message, configuration option, or user-facing behavior, you MUST update the corresponding doc file in `docs/`.**

This ensures documentation stays in sync with the code. Each feature has one doc file — when the feature changes, update that file.
