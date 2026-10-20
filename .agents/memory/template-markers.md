---
name: Template markers and variables
description: Conventions for per-template free variables ({{var_*}}) and the 1341/1342 specific-approval block in contract templates.
---
- Free per-contract fields: any `{{var_*}}` placeholder becomes a form field; optional label/type via `<!-- VAR var_x | Label | testo lungo | hint -->`. Empty value = placeholder stays = sending blocked (same gate as other placeholders).
- Specific approval (artt. 1341-1342 c.c.): text between `<!-- APPROVAZIONE_SPECIFICA -->` and `<!-- /APPROVAZIONE_SPECIFICA -->` renders as its own section after the signature with a second signature (`signatures.clausole`); the sign route rejects without it.

**Why:** the template editor is a raw HTML textarea and the block lives in the frozen generated content, so no schema change and old contracts render identically.

**How to apply:** new per-tenant template needs → add markers/vars in the HTML, don't add DB columns. Tenant templates/presets ship via `scripts/onboarding/<cliente>/config.json` run on the VPS.
