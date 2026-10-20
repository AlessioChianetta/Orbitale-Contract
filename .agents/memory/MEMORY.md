# Memory index

- [Multi-tenant data layout](multi-tenant-data.md) — rows scoped via creator/seller join; owner-only features gate on company_settings.is_owner; users deactivated, never deleted.
- [Type-check baseline](typecheck-baseline.md) — `npm run check` fails on ~100 pre-existing errors; judge regressions only by new errors on touched files.
- [Drizzle db:push hang](drizzle-db-push.md) — never run plain db:push (interactive drift prompt hangs in non-TTY); apply schema via raw SQL + manual schema.ts sync.
- [Contract send-pipeline invariants](contract-send-pipeline.md) — preview/create/update placeholder gates share one helper; preview-token HMAC must hash every content-affecting field.
- [OTP channel truth](otp-audit-truth.md) — twilioVerify is the only ground truth; legacy method/otpMethod fields lie except when they say "email"; unknown channel renders neutral.
- [Workspace DB vs live DB](live-db-and-post-merge.md) — live site (VPS) uses a separate DB; prod changes via scripts on VPS; schema changes via idempotent startup SQL, never db:push.
- [Task files](task-files-convention.md) — owner wants plans as task-da-fare/NNN-slug.md, in Italian.
- [Signed PDF invariants](signed-pdf-invariants.md) — registry frozen at signature, no unrecorded/legal claims, signed = immutable, tenant creds only, no emoji.
- [PDF = client page](pdf-client-view-parity.md) — owner rule: signing page and PDF must be identical (one renderer); never diverge, never ask.
- [Document layout versioning](document-layout-versioning.md) — renderer changes must leave documentLayout 1 identical; new rules go to a new layout version, never mutate old flags.
- [Route-level tests](route-tests.md) — full app + fake SMTP + throwaway tenants; close Chromium in after(), one X-Forwarded-For per simulated browser.
- [Payment plan rules](payment-plan-rules.md) — cents math, sum = total enforced, activation optionally first payment; npm test must run serially.
- [Template markers](template-markers.md) — {{var_*}} free fields + APPROVAZIONE_SPECIFICA block for 1341/1342 second signature; tenant templates ship via onboarding config.
- [Chromium PDF quirk](pdf-chromium-single-process.md) — single-process Chromium loses the page on image-after-plain PDFs; renderPdf retries with a fresh browser.
- [Lockfile registry](lockfile-registry.md) — Replit npm proxy URLs leak into package-lock and break VPS installs; always rewrite to registry.npmjs.org.
- [Real email tests](dev-email-tests.md) — .env BASE_URL is prod; run a 2nd server with BASE_URL=dev domain to send test contracts; test tenant 176 uses owner SMTP.
- [Email design](email-design.md) — all emails share one neutral layout (company name, black button, no platform branding); new emails must reuse it.
