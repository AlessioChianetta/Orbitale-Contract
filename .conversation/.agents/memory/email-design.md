---
name: Email design
description: All transactional emails share one neutral layout; rules for adding or changing an email.
---

Every email (client and operator) is built from the shared layout helpers in the email layout module: company name on top, white card, black pill button, no platform branding, no emoji, inline styles + tables only.

**Why:** owner asked (Oct 2026) for emails matching the neutral signing-page design; the old blue "Sistema di gestione contratti" header looked like a generic system and is gone.
**How to apply:** new emails must use the same helpers, never a custom `<style>` block; keep the sender name = tenant company name; tests check the request email wording per OTP channel ("codice di verifica via email" / "via SMS", no "SMS"/"telefono" in the email variant) and the signed email date format.
