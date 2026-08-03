#!/usr/bin/env bash
set -euo pipefail
HOOKS="src/lib/video/hooks.ts"
ERRORS=0
echo "=== Recording lifecycle validation ==="
grep -q "window.startRecording?.()" "$HOOKS" 2>/dev/null || { echo "ERROR: startRecording missing"; ERRORS=$((ERRORS+1)); }
grep -q "window.stopRecording?.()" "$HOOKS" 2>/dev/null || { echo "ERROR: stopRecording missing"; ERRORS=$((ERRORS+1)); }
[ $ERRORS -eq 0 ] && echo "OK: hooks.ts wired correctly." || { echo "FAILED: $ERRORS error(s)."; exit 1; }
