---
name: Real email tests from the workspace
description: How to send a real test contract from the Replit workspace without prod links.
---
`.env` sets BASE_URL to the production domain, so emails sent by the dev workflow link to the VPS, where workspace contracts don't exist. For a real send test, run a second server with `BASE_URL=https://$REPLIT_DEV_DOMAIN PORT=5055 npm run dev` and drive the UI against it; the link then opens on the dev workflow (same DB).

A test copy of the client's tenant (Elvira, company 176) lives in the workspace DB with the owner's SMTP copied in, admin/seller emails are the owner's Gmail plus-addresses.

Without a known seller password, the agent sends via the API as a dedicated seller `invio.prova.agente` in company 176 (random password set at each run, scrypt hash `hex.salt`); payload copied from contract 2026-0001 (template 189, `totalValue` must be a number). Don't deactivate it: the client page/notifications depend on an active seller.

**Why:** owner asked for a seller-style test send; real tenant admin email must never receive test mail.

**How to apply:** reuse company 176 for future send tests; never put the real client's email on test accounts.
