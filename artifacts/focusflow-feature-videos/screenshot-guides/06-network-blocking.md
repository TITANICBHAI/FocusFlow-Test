# Screenshot Guide — Network Blocking

**Video file:** `src/videos/features/NetworkBlocking.tsx`
**Scenes:** 3 · ~22 sec total

---

## YOUR INSTRUCTIONS (what to capture on device)

### Screenshot A — `vpn-block-settings.png`
**Where:** Side Menu → Block Enforcement → System Protection → VPN Block (or wherever the VPN toggle lives).
**State:** VPN Block toggle is ON (green). Per-app VPN list visible below showing which apps have network cut.
**Capture:** Full portrait screenshot with the VPN toggle clearly in the ON position.

### Screenshot B — `per-app-vpn-list.png`
**Where:** Same screen as above, or a sub-screen showing the per-app VPN selection.
**State:** At least 3 apps listed (Instagram, YouTube, TikTok or similar) each showing they have VPN blocking enabled. VPN Self-Heal toggle visible if available.
**Capture:** Full portrait screenshot of this per-app list.

### Screenshot C — `enforcement-layers-active.png`
**Where:** Side Menu → Block Enforcement (the main hub showing all layers).
**State:** All three main layers active: Accessibility Service (app blocking ON), VPN Block (ON), System Protection (ON). This is the "three enforcement layers" summary screen.
**Capture:** Full portrait screenshot.

---

## MY INSTRUCTIONS (where each screenshot goes in the code)

| Screenshot | Scene | Placement |
|---|---|---|
| `vpn-block-settings.png` | Scene 1 | Replace the "VPN Network Block" explanation card (lines 33–39) with a phone frame containing the screenshot |
| `per-app-vpn-list.png` | Scene 2 | Replace the VPN toggle + per-app list + self-heal row (lines 75–119) with a phone frame screenshot |
| `enforcement-layers-active.png` | Scene 3 | Replace the 3-layer list (`layers.map()` lines 141–157) with a phone frame screenshot |

**Implementation note:** Scene 2's heading ("Per-app network blocking") stays above the phone frame. Scene 3's closing tagline ("Three enforcement layers. Nothing bypasses all three.") stays below.

**Import lines to add:**
```ts
import vpnBlockSettings from '@assets/screenshots/vpn-block-settings.png';
import perAppVpnList from '@assets/screenshots/per-app-vpn-list.png';
import enforcementLayersActive from '@assets/screenshots/enforcement-layers-active.png';
```
