import { router } from 'expo-router';

const LOCK_MS = 800;
let locked = false;

/**
 * Guarded router.push for user-initiated or notification-driven navigation.
 * Returns false when another navigation is still within the lock window.
 */
export function navPush(href: string | object): boolean {
  if (locked) return false;
  locked = true;
  router.push(href as never);
  setTimeout(() => {
    locked = false;
  }, LOCK_MS);
  return true;
}