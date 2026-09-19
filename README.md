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
Set sensitive production environment variables `OPENAI_API_KEY`, `DEMO_PASSWORD`, and optionally `OPENAI_MODEL` (default `gpt-5.4`). Redeploy after changing variables. Preview deployments fail closed until separately configured. The private `Clik-Works/bootprint-demo-proposal-pdf` repository is connected to Vercel; pushes to `main` deploy to production.

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

Transcripts are sent to OpenAI only on generation and are not persisted by the app. OpenAI and hosting provider policies still apply. Proposal history, edited text, review notes and original generated fields are stored in the browser's local storage and downloaded draft JSON; they are not uploaded to a shared database. Do not use a shared browser profile for confidential work. History keeps separate proposals and automatically migrates the previous single browser draft. There is no cloud or cross-device history. Source transcripts and client example files are not bundled in this repository.

## Code

- `lib/generation.mjs`: instructions, strict schema, response validation, OpenAI call.
- `lib/fields.json`: semantic fields and character limits.
- `api/service.js`: login, session check, generation and logout.
- `public/editor.html` + `proposal.css`: fixed four-page layout.
- `public/editor.js`: text-only editing, synchronized repeated fields, overflow guard.
- `public/app.js`: separate New, Preparing, History and Proposal screens, generation, review, draft import/export and PDF action.
- `public/history.js`: browser history, legacy draft migration, safe record merging, search and status filtering.

## References

[OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
[Vercel Node.js Functions](https://vercel.com/docs/functions/runtimes/node-js)

## Validation (2026-09-19)

Six contract/security tests pass. Live production sign-in, unauthorized API rejection, generation, secret-path 404 checks, repeated-field editing and browser persistence were checked. A generated proposal printed to exactly four A4 pages in Chrome; deliberate overflow disabled export. Initial GPT-4.1-mini output failed content review; the default was changed to GPT-5.4 and field guidance tightened. Two GPT-5.4 test generations succeeded, including missing-number defaults. AE review remains necessary, particularly for tool-cost inclusion, assumptions and source interpretation.

## Studio UX update (2026-09-19)

The input form and document editor now have separate routes. Generation opens a preparation screen, then the result opens in a full document workspace with a collapsible review panel, page navigation, fit-to-width preview, Undo and export. History shows company, fee, duration, lead scope, saved date and review status, with search and filters. Every new generation/import creates its own record. Existing single-draft browser storage is migrated without deleting its original entry. New records and newer edits in other tabs are preserved when saving. Source transcripts are not added to history.

Thirteen unit tests and a browser workflow check cover migration, draft isolation, reload, edits, filtering, import/export, failed-generation input recovery, overflow blocking and mobile layout. UI testing uses a captured response, not another paid API generation.

## Minimal result screen (2026-09-19)

At the user's request, the proposal result now shows only the editable A4 pages and Export PDF. App navigation, metadata, review notes, page navigation and extra editing controls are hidden in this view. PDF export no longer requires a review checkbox; overflow validation still blocks clipped output. History and creation screens remain available through browser navigation, and draft JSON backups can be downloaded from History. Source/review metadata remains in saved records.
