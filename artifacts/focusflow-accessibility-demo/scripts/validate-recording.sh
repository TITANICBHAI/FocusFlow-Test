#!/usr/bin/env bash
set -euo pipefail

HOOKS_FILE="src/lib/video/hooks.ts"
TEMPLATE_FILE="src/components/video/VideoTemplate.tsx"

ERRORS=0

echo "=== Recording lifecycle validation ==="

if ! grep -q "window.startRecording?.()" "$HOOKS_FILE" 2>/dev/null; then
  echo "ERROR: window.startRecording?.() missing from $HOOKS_FILE"
  ERRORS=$((ERRORS + 1))
fi

if ! grep -q "window.stopRecording?.()" "$HOOKS_FILE" 2>/dev/null; then
  echo "ERROR: window.stopRecording?.() missing from $HOOKS_FILE"
  ERRORS=$((ERRORS + 1))
fi

if ! grep -q "useVideoPlayer" "$TEMPLATE_FILE" 2>/dev/null; then
  echo "ERROR: useVideoPlayer not used in $TEMPLATE_FILE"
  ERRORS=$((ERRORS + 1))
fi

if [ $ERRORS -eq 0 ]; then
  echo "OK: Recording lifecycle is wired up correctly."
else
  echo "FAILED: $ERRORS error(s) found."
  exit 1
fi
