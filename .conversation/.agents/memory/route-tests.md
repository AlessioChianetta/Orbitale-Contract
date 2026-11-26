---
name: Route-level tests
description: How HTTP route tests run against the real DB without hanging or tripping rate limits.
---

Route tests start the full app on a random port (tests/helpers/http-app.ts), use throwaway tenants (tests/helpers/tenants.ts, full cleanup incl. PDFs/sessions/counters) and a local fake SMTP server (tests/helpers/smtp-sink.ts) set as the tenant's SMTP host.

- Any test that signs a contract must call `closePdfBrowser()` in `after`, or the node:test process never exits (Chromium stays open) and `npm test` hangs.
- Public client routes are rate-limited per IP (OTP: 5 per 15 min). Give each simulated browser its own `X-Forwarded-For` (Agent `ip` param; trust proxy is 1).
- Email OTP codes are read from `otp_codes` (plain text), not parsed from the email.
- Route tests that post signatures by hand cannot catch client-page bugs: a client page that never showed the second (clausole) signature box shipped while all route tests passed. The signing page has a real-browser test (`startTestApp({ frontend: true })` serves Vite; puppeteer signs, types the OTP, clicks Firma). Any change to the client signing page must keep that test green; `UI_SHOTS=<dir>` saves panel screenshots.
- The signing page auto-scrolls to the next step after each signature/OTP; in the browser test wait ~1s after those actions before clicking, or puppeteer clicks land mid-scroll. Piping test output to `head` kills the run (SIGPIPE): redirect to a file instead.
- The public client payload's `template` has no `content`; anything derived from the contract text on the client page must read `generatedContent` (same source as the server).

**Why:** found while writing the onboarding-task test suite (Oct 2026); the hang looked like a timeout, not a failure.
**How to apply:** reuse the helpers for new route tests; never send to real SMTP from tests (workspace DB/BASE_URL are live-like).
