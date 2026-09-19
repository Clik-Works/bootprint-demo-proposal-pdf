# Bootprint Demo – Proposal PDF

Password-protected demo: paste a call transcript, generate a structured proposal using OpenAI, review assumptions, click any text to edit, and print four branded A4 pages to PDF.

## Run locally

Node 22+ is required. Copy `.env.example` to `.env.local`, fill in the server-only variables, then run:

```sh
node --env-file=.env.local dev.mjs
npm test
npm run build
```

Use http://127.0.0.1:8780. `DEMO_PASSWORD` must be at least 20 characters; use a randomly generated password. Never commit real environment files.

## Vercel

Framework: Other. Build command: `npm run build`. Output directory: `public`.
Set sensitive production environment variables `OPENAI_API_KEY`, `DEMO_PASSWORD`, and optionally `OPENAI_MODEL` (default `gpt-5.4`). Redeploy after changing variables. Preview deployments fail closed until separately configured. Connect this GitHub repository in Project Settings > Git to deploy new commits automatically.

## Workflow

- Paste transcript text or upload a `.txt` file (maximum 100,000 characters).
- Optional AE instructions can set company, scope, fee, and timeline.
- The model returns 59 bounded plain-text fields and internal review notes using the Responses API with strict Structured Outputs and `store: false`.
- Missing quantities default to 3,000 leads, 45 days, and $5,000. Full advance is the default payment term. Relevant explicit terms remain; rejected offers must not become accepted deals.
- Review assumptions and edit directly in the document. Repeated bound company, provider, fee, duration and status fields update together. Values repeated inside generated prose require manual review after an edit.
- Export opens the browser print dialog. Choose Save as PDF, A4, 100% scale, disable browser headers/footers, and enable background graphics. CSS declares A4 with fixed margins and page breaks. Overflow blocks the normal export action. Browser-specific print settings can affect output.

## Data and access

The server key is never sent to the browser. A random demo password protects generation through a signed, HttpOnly, SameSite=Strict, 12-hour cookie (Secure on Vercel). POST requests require same-origin JSON. Generation is bounded to one Responses call, 6,500 output tokens and a 105-second upstream timeout; failures do not automatically retry or replace the draft.

This is a shared-password test app, not a multi-tenant product. It does not have a durable per-user rate limit, database, team permissions or centralized revision history. Keep the password private and set an appropriate OpenAI project budget. Calls made in the demo use the configured account and incur API charges.

Transcripts are sent to OpenAI only on generation and are not persisted by the app. OpenAI and hosting provider policies still apply. Proposal text, review notes and original generated fields are stored in the browser's local storage and downloaded draft JSON; they are not uploaded to a shared database. Do not use a shared browser profile for confidential work. Clear draft removes the prior local draft. Source transcripts and client example files are not bundled in this repository.

## Code

- `lib/generation.mjs`: instructions, strict schema, response validation, OpenAI call.
- `lib/fields.json`: semantic fields and character limits.
- `api/service.js`: login, session check, generation and logout.
- `public/editor.html` + `proposal.css`: fixed four-page layout.
- `public/editor.js`: text-only editing, synchronized repeated fields, overflow guard.
- `public/app.js`: generation, review, local draft save/import and PDF action.

## References

[OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
[Vercel Node.js Functions](https://vercel.com/docs/functions/runtimes/node-js)
