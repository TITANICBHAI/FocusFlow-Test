---
name: User-controlled diagnostic email
description: FocusFlow issue reporting uses a native email draft with a local text attachment and never sends diagnostics through a server relay.
---

FocusFlow diagnostic reporting must remain explicitly user-controlled: prepare a sanitized local `.txt` attachment, open the native mail composer addressed to the support mailbox, and require the user to review and tap Send.

**Why:** Automatic delivery was not authorized and would require a secure server-side mail connection; the native composer preserves user consent and supports attachments.

**How to apply:** Keep bug reports, feedback, and app reviews on this same draft-and-attachment flow unless the user explicitly authorizes a secure server integration.