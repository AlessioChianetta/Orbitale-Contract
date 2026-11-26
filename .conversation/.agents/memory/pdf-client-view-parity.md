---
name: PDF and client page must be identical
description: Owner rule (16/10/2026): the signed PDF and the client signing page show the same document, same look; never style or change one without the other.
---

Rule: the client signing page and the PDF must always look the same. Never diverge them and never ask the owner whether to align them. Owner's words: "devono sempre essere uguali, mai distinte, non facciamo doppio lavoro, risolviamo il problema alla base così non me lo chiedi più".

**Why:** the owner does not want two documents to maintain. He had to ask twice.

**How to apply:** both render from `shared/contract-document.ts` (done 16/10/2026). Any visual or content change goes there, never into a consumer. Also keep the public `/api/client/contracts/:code` payload carrying every field the PDF prints (template name, customContent, paymentText, bonuses, company uniqueCode), or the page silently drops sections. A test guards against duplicating the document text.
