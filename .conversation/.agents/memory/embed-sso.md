---
name: Embedded SSO from conorbitale.it
description: Rules for the signed one-time login used when the app is iframed by the owner's other site.
---
The owner's other software (www.conorbitale.it, different site from orbitalecontract.it) iframes this app and logs users in via a server-signed one-time token (shared secret, short expiry, nonce stored in DB). Only SSO sessions get SameSite=None/Secure/Partitioned cookies; normal logins keep the default cookie.
**Why:** cross-site iframe needs third-party-capable cookies, but making all sessions SameSite=None would expose every user to CSRF.
**How to apply:** any req.logIn on an SSO session must re-apply the embed cookie (logIn regenerates the session); SSO sessions reject state-changing requests not from same origin; Safari blocks it in iframes → "open in new tab" fallback.
