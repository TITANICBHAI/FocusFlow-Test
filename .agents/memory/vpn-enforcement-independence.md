---
name: VPN enforcement independence
description: Durable separation between FocusFlow VPN network blocking and ordinary overlay/accessibility blocking.
---

VPN protection is an independent enforcement layer. A package may be selected for VPN blocking without being selected for an overlay block, and a configured VPN package list must activate and remain health-monitored even when no ordinary focus or standalone block session is active.

**Why:** The product requirement is to block network traffic for selected apps without making AccessibilityService detection a prerequisite; coupling the two causes VPN-only selections to be inert.

**How to apply:** Keep canonical VPN package lists merged across their supported scopes, start/stop the native tunnel from the effective VPN settings rather than session-active flags, and preserve the AccessibilityService text-event pipeline separately.