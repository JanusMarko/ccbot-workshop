---
title: File Upload
description: Uploading files to Claude Code sessions
order: 6
---

# File Upload

Upload files to your Claude Code session for analysis, review, or processing.

## How to Upload

1. **Click the `Attach` button** in the toolbar above the message input
2. **Or drag and drop** a file onto the Attach button

The file is saved to `{project}/docs/inbox/{filename}` in the session's working directory. Claude is automatically told about the file and its path.

## Supported File Types

Any file type is accepted. Common uses:
- Code files for review
- Markdown/text documents
- PDF documents
- Images (screenshots, diagrams)
- Word documents

## What Happens After Upload

1. The file is saved to the session's `docs/inbox/` directory
2. A message is sent to Claude: "A file has been saved to docs/inbox/{name}. Read it with your Read tool."
3. Claude can then read and process the file

## Limitations

- The session must have a known working directory (the SessionStart hook must have fired)
- Very large files may take a moment to upload
- The file is saved server-side, not streamed to Claude directly
