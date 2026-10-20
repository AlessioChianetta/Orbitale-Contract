---
name: Real email tests from the workspace
description: How to send a real test contract from the workspace without touching real tenants.
---
`.env` BASE_URL is the production domain and the DB is the live one. For a real send test run a second server with `BASE_URL=https://$REPLIT_DEV_DOMAIN PORT=5055 npm run dev`.

Never use company 176 (Elvira's real tenant) or any real tenant for tests. Create a throwaway non-owner company with owner-Gmail plus-address users, and delete it afterwards.

**Why:** test sellers/contracts and the owner's SMTP once polluted the real client's account.
**How to apply:** test mail only to the owner's chianettaalessio plus-addresses, from a throwaway tenant.
