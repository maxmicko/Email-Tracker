# Email Tracker — Minimal
Drop this in a repo. Minimal Node/Express tracker for email opens + clicks.

## Setup
1. Create Postgres DB and run `sql/schema.sql`.
2. Copy `.env.example` to `.env` and fill values.
3. `npm install`.
4. `node server.js`.

## Send
Use `send-example.js` or integrate `html-generator.js` into your sending flow.

## Notes
- Opens are noisy (image proxies, prefetch).
- Signed URLs prevent spoofed logs.
- Add unsubscribe handling + SPF/DKIM for deliverability.