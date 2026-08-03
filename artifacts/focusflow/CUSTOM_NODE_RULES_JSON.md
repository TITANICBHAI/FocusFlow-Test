# FocusFlow Custom Node Rules JSON

FocusFlow can block a specific UI element inside another Android app by matching that app's accessibility node tree. NodeSpy is the easiest way to create these rules, but it is not required. A developer can generate compatible JSON from any accessibility inspector as long as the same fields are provided.

## How FocusFlow uses the rules

The Android accessibility service receives the current foreground package and scans the visible node tree.

For each enabled rule:

1. `pkg` must exactly equal the foreground app package.
2. At least one selector must be present:
   - `matchResId`
   - `matchText`
   - `matchCls`
3. All provided selectors are matched with AND logic.
4. Selector matching is case-insensitive substring matching.
5. Only visible nodes can trigger a rule, but invisible parent nodes are still traversed.
6. If a rule matches, FocusFlow performs its action:
   - `overlay`: show the FocusFlow block overlay.
   - `home`: press Android HOME.

Example: if a rule has both `matchResId` and `matchText`, the same visible node must match both fields.

## Runtime rule shape

This is the direct rule object FocusFlow stores internally.

```json
{
  "id": "cnr_youtube_shorts_tab",
  "label": "YouTube Shorts tab",
  "pkg": "com.google.android.youtube",
  "matchResId": "com.google.android.youtube:id/reel_watch_while_button",
  "matchText": "Shorts",
  "matchCls": "Button",
  "action": "overlay",
  "enabled": true,
  "confidence": 92,
  "qualityTier": "strong",
  "selectorType": "resourceId+label",
  "stability": 1,
  "warnings": [],
  "importedAt": "2026-04-20T00:00:00.000Z",
  "captureTimestamp": 1776643200000
}
```

### Required fields

| Field | Type | Required | Meaning |
|---|---:|---:|---|
| `id` | string | yes | Unique rule ID. |
| `label` | string | yes | Human-readable name shown in settings. |
| `pkg` | string | yes | Exact Android package to match. |
| `action` | `"overlay"` or `"home"` | yes | What FocusFlow does when the rule matches. |
| `enabled` | boolean | yes | Disabled rules are ignored. |
| `importedAt` | ISO string | yes | Timestamp used for display. |

### Selector fields

At least one selector must be present and non-empty.

| Field | Source accessibility field | Matching behavior |
|---|---|---|
| `matchResId` | `AccessibilityNodeInfo.viewIdResourceName` | Case-insensitive substring |
| `matchText` | `text` plus `contentDescription` | Case-insensitive substring |
| `matchCls` | `className` | Case-insensitive substring |

Best reliability:

1. `matchResId` + `pkg`
2. `matchResId` + `matchText`
3. `matchText` when the label is stable and unique
4. `matchCls` only as a last resort

Avoid bounds-only rules. FocusFlow does not currently enforce bounds selectors because screen sizes, layouts, and app versions make them fragile.

### Optional quality metadata

These fields are displayed in FocusFlow but are not required by the native matcher:

| Field | Type | Meaning |
|---|---:|---|
| `confidence` | number | 0–100 quality score from your tool. |
| `qualityTier` | `"strong"`, `"medium"`, or `"weak"` | Human-readable quality bucket. |
| `selectorType` | string | Example: `resourceId`, `label`, `resourceId+label`. |
| `stability` | number | 0–1 score showing whether the selector appeared across multiple captures. |
| `warnings` | string[] | Warnings shown to the user. |
| `captureTimestamp` | number | Unix ms timestamp of the source capture. |

## NodeSpyCaptureV1 import format

The FocusFlow import screen accepts a full `NodeSpyCaptureV1` JSON object. If `recommendedRules` exists, FocusFlow imports those rules. If `recommendedRules` is absent, FocusFlow falls back to `pinnedNodeIds` and derives rules from the matching entries in `nodes`.

Minimum compatible export:

```json
{
  "format": "NodeSpyCaptureV1",
  "version": 1,
  "timestamp": 1776643200000,
  "pkg": "com.google.android.youtube",
  "nodes": [
    {
      "id": "n42",
      "cls": "android.widget.Button",
      "resId": "com.google.android.youtube:id/reel_watch_while_button",
      "text": "Shorts",
      "desc": "Shorts",
      "flags": {
        "visible": true
      },
      "depth": 8
    }
  ],
  "pinnedNodeIds": ["n42"]
}
```

With this fallback format, FocusFlow creates one rule per pinned node:

- `pkg` comes from the export root.
- `matchResId` comes from `node.resId`.
- `matchText` comes from `node.text` or `node.desc`, truncated to 100 characters.
- `matchCls` is not set by the fallback importer.
- The user chooses `overlay` or `home` during import.

## Recommended modern export format

For custom tooling, prefer generating `recommendedRules`. This lets you control exactly what FocusFlow imports and lets you include confidence metadata.

```json
{
  "format": "NodeSpyCaptureV1",
  "version": 1,
  "timestamp": 1776643200000,
  "pkg": "com.google.android.youtube",
  "nodes": [
    {
      "id": "n42",
      "cls": "android.widget.Button",
      "resId": "com.google.android.youtube:id/reel_watch_while_button",
      "text": "Shorts",
      "desc": "Shorts",
      "flags": {
        "visible": true
      },
      "depth": 8
    }
  ],
  "pinnedNodeIds": ["n42"],
  "ruleQuality": {
    "totalPinned": 1,
    "exportableRules": 1,
    "strongRules": 1,
    "mediumRules": 0,
    "weakRules": 0,
    "averageConfidence": 92,
    "warnings": []
  },
  "recommendedRules": [
    {
      "nodeId": "n42",
      "label": "YouTube Shorts tab",
      "pkg": "com.google.android.youtube",
      "selector": {
        "matchResId": "com.google.android.youtube:id/reel_watch_while_button",
        "matchText": "Shorts"
      },
      "selectorType": "resourceId+label",
      "confidence": 92,
      "tier": "strong",
      "stability": 1,
      "warnings": []
    }
  ],
  "exportPolicy": {
    "defaultImportSource": "recommendedRules",
    "recommendedRulesOnly": true,
    "weakRulesExcluded": 0
  }
}
```

## Building your own generator

A custom generator should:

1. Capture the target app's accessibility tree.
2. Let the user choose the exact UI element to block.
3. Prefer nodes with stable `viewIdResourceName`.
4. Add text/content-description only when it narrows the selector.
5. Avoid broad class-only selectors unless there is no better option.
6. Capture the same screen multiple times and score stability.
7. Export only medium/strong recommendations in `recommendedRules`.

Suggested scoring:

| Signal | Suggested score |
|---|---:|
| Unique resource ID in capture | +45 to +50 |
| Reused but useful resource ID | +30 to +35 |
| Unique visible text or content description | +20 to +25 |
| Node is clickable/actionable | +5 to +10 |
| Selector appears across repeated captures | +10 to +15 |
| Class-only selector | weak, usually below 55 |

Suggested tiers:

- `strong`: 80–100
- `medium`: 55–79
- `weak`: 0–54

FocusFlow will import `recommendedRules` even if they are medium quality. If you include an empty `recommendedRules` array, FocusFlow treats that as "no safe rules to import" and will not fall back to pinned nodes.

## Direct injection format

If a developer bypasses the import UI and writes directly to FocusFlow's stored settings, use an array of runtime rules:

```json
[
  {
    "id": "cnr_example_1",
    "label": "Block Shorts",
    "pkg": "com.google.android.youtube",
    "matchResId": "com.google.android.youtube:id/reel_watch_while_button",
    "matchText": "Shorts",
    "action": "overlay",
    "enabled": true,
    "importedAt": "2026-04-20T00:00:00.000Z"
  }
]
```

The native service expects this stored value to be a JSON array of rule objects, not a full `NodeSpyCaptureV1` object.