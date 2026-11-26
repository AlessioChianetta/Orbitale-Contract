---
name: OTP channel truth in audit data
description: Which audit-log fields truthfully identify the OTP delivery channel/contact and which historical fields lie. Read before touching audit rendering or OTP-method resolution.
---

Rule: `twilioVerify` on `otp_sent` metadata is the only ground truth for the delivery channel (`true` = SMS via Twilio, `false` = email; the app never had a non-Twilio SMS path). The historical `method` field is trustworthy ONLY when it says `email` — the bug era derived it from phone presence and stamped `sms` on real email sends; no code path ever mislabeled an SMS send as `email`. The same asymmetry applies to the frozen `otpMethod` on signed rows (one era wrote uppercase `SMS` while delivery was actually email).

**Why:** a third of historical `otp_sent` rows lack `twilioVerify` (most say `method=sms` — the ambiguous era; the few saying `email` are safe). One archived contract froze `otpMethod='sms'` with `twilioVerify:false` — the canonical lie. The signed PDF is a legal record: an UNKNOWN channel must render neutrally ("non registrato nei log"), never repeat the lie.

**How to apply:** resolution precedence in BOTH the sign route and the PDF audit renderer: `twilioVerify` of the latest `otp_sent` → frozen `otpMethod` → `method` only-if-email → neutral/unknown. Never invent a destination; for legacy email-channel signatures, `emailUsedForSigning` is the true verified contact. New `otp_sent`/`signed` writes always include `twilioVerify`/`sentTo`/`verifiedContact`, so heuristics are for old rows only.
