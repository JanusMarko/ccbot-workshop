---
title: File Upload
description: Uploading files to Claude Code sessions for analysis or processing
order: 6
---

# File Upload

Upload files to your Claude Code session for analysis, review, or processing. Files are saved to the project's `docs/inbox/` directory and Claude is automatically notified of the file's path.

## How to Upload

### Click to Browse

Click the **Attach** button in the toolbar above the message input. A file picker opens where you can select any file from your computer.

### Drag and Drop

Drag a file from your file manager onto the **Attach** button. The button highlights when a file is dragged over it.

## What Happens After Upload

1. The file is sent to the backend via `POST /api/sessions/{window_id}/upload` as multipart form data
2. The backend saves the file to `{session_cwd}/docs/inbox/{filename}`
3. If a file with the same name already exists, a timestamp suffix is added (e.g., `report_1712345678.md`)
4. The backend sends a text message to Claude via tmux: *"A file has been saved to docs/inbox/{name} (absolute path: {full_path}). Read it with your Read tool."*
5. Claude receives this as user input and can read the file using its Read tool

The file is saved server-side (on the machine running CCWeb), not uploaded to Anthropic. Claude Code reads it from the local filesystem.

## Supported File Types

Any file type is accepted. Common uses:

| Type | Examples | Use Case |
|------|----------|----------|
| Code | `.py`, `.js`, `.tsx`, `.go` | Code review, analysis |
| Documents | `.md`, `.txt`, `.rst` | Content to process or reference |
| PDF | `.pdf` | Documentation, specs |
| Word | `.docx` | Documents to convert or analyze |
| Images | `.png`, `.jpg`, `.svg` | Screenshots, diagrams (Claude can see images) |
| Data | `.json`, `.csv`, `.yaml` | Configuration, data files |

## Security

The filename is sanitized before saving — directory components are stripped using `Path(filename).name` to prevent path traversal attacks (e.g., a filename like `../../etc/passwd` becomes just `passwd`).

## Prerequisites

The session must have a known working directory — the `SessionStart` hook must have fired and written to `session_map.json`. This typically happens within a few seconds of Claude Code starting. If the working directory is not yet known, the upload returns an error.

## Limitations

- **No caption/instruction** — the upload sends a generic "file saved" message. If you want to tell Claude what to do with the file, send a follow-up message.
- **No preview** — uploaded files are not previewed in the message stream (this would require reading them back).
- **File size** — limited by the FastAPI/uvicorn upload limit (default ~100MB). Very large files may be slow to upload over Tailscale.
- **One file at a time** — the upload UI handles one file per click. For multiple files, click Attach multiple times.
