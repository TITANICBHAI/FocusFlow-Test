/**
 * navigationRef.ts
 *
 * Navigation helper that works with Expo Router.
 *
 * The old @react-navigation/native `createNavigationContainerRef` approach
 * never attaches to Expo Router's internal navigator, so `isReady()` is always
 * false and every `navigate` call silently no-ops (BUG-011 / NEW-020).
 *
 * This module replaces that with:
 *   1. expo-router's `router` for in-process navigation (foreground / active app).
 *   2. A deferred-navigation store for headless / background contexts where the
 *      navigator is not yet mounted. The pending taskId is picked up by
 *      `consumePendingTaskNavigation()` on the next app open.
 */

import { router } from 'expo-router';

let pendingTaskId: string | null = null;

/**
 * Navigate to the Schedule tab and highlight a specific task card.
 *
 * Safe to call from headless background tasks — if the navigator is not
 * mounted the taskId is stored and consumed on the next app open via
 * `consumePendingTaskNavigation()`.
 */
export function navigateToTask(taskId: string): void {
  try {
    router.push({ pathname: '/(tabs)', params: { highlightTaskId: taskId } });
  } catch {
    // Navigator not mounted (headless context) — defer until next open.
    pendingTaskId = taskId;
  }
}

/**
 * Call this from the root layout's useEffect after the navigator is ready.
 * If a background task stored a pending navigation, it will be consumed here.
 */
export function consumePendingTaskNavigation(): void {
  if (!pendingTaskId) return;
  const taskId = pendingTaskId;
  pendingTaskId = null;
  try {
    router.push({ pathname: '/(tabs)', params: { highlightTaskId: taskId } });
  } catch {
    // Still not ready — ignore; the deferred intent was best-effort.
  }
}
