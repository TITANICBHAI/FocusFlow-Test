/**
 * BlockOverlayModule — Old Architecture (NativeModules bridge)
 *
 * Configures the native BlockOverlayActivity shown when the AccessibilityService
 * blocks an app. All settings are persisted in SharedPreferences ("focusday_prefs")
 * so the overlay can read them without a live JS bridge at block time.
 *
 * Kotlin: android-native/app/.../modules/BlockOverlayModule.kt
 * Registered via: FocusDayPackage → createNativeModules()
 *
 * Methods:
 *   setOverlayQuote(quote)         — pin a fixed quote; pass "" for random mode
 *   setCustomQuotes(quotesJson)    — replace the random pool (JSON array string)
 *   clearCustomQuote()             — clear pinned quote, return to random selection
 *   setOverlayWallpaper(path)      — absolute path to JPEG/PNG background image
 *   clearOverlayWallpaper()        — remove custom wallpaper
 *   getDefaultQuotes()             → Promise<string>  (JSON array)
 *   getOverlaySettings()           → Promise<string>  (JSON object)
 */

import { NativeModules, Platform } from 'react-native';

const BlockOverlay = Platform.OS === 'android' ? NativeModules.BlockOverlay : null;

if (Platform.OS === 'android' && !BlockOverlay) {
  console.warn(
    '[BlockOverlayModule] NativeModules.BlockOverlay not found. ' +
    'Ensure an EAS build is used — Expo Go does not include custom native modules.',
  );
}

function has(name: string): boolean {
  return !!BlockOverlay && typeof BlockOverlay[name] === 'function';
}

export interface BlockOverlaySettings {
  quote: string;
  quotesJson: string;
  wallpaperPath: string;
}

export const BlockOverlayModule = {
  /** Pin a specific quote on the overlay. Pass "" to return to random mode. */
  async setOverlayQuote(quote: string): Promise<void> {
    if (!has('setOverlayQuote')) return;
    return BlockOverlay.setOverlayQuote(quote);
  },

  /**
   * Replace the random quote pool with a custom list.
   * Pass an empty string or "[]" to restore the built-in 15 default quotes.
   */
  async setCustomQuotes(quotesJson: string): Promise<void> {
    if (!has('setCustomQuotes')) return;
    return BlockOverlay.setCustomQuotes(quotesJson);
  },

  /** Clear the pinned quote — overlay returns to random selection. */
  async clearCustomQuote(): Promise<void> {
    if (!has('clearCustomQuote')) return;
    return BlockOverlay.clearCustomQuote();
  },

  /**
   * Set the wallpaper background for the overlay.
   * [absolutePath] must be a readable file path already present on device.
   */
  async setOverlayWallpaper(absolutePath: string): Promise<void> {
    if (!has('setOverlayWallpaper')) return;
    return BlockOverlay.setOverlayWallpaper(absolutePath);
  },

  /** Remove the custom wallpaper; overlay shows its built-in dark gradient. */
  async clearOverlayWallpaper(): Promise<void> {
    if (!has('clearOverlayWallpaper')) return;
    return BlockOverlay.clearOverlayWallpaper();
  },

  /**
   * Returns the built-in default quote pool as a JSON array string.
   * Falls back to "[]" when the native module is unavailable.
   */
  async getDefaultQuotes(): Promise<string> {
    if (!has('getDefaultQuotes')) return '[]';
    return BlockOverlay.getDefaultQuotes();
  },

  /**
   * Returns current overlay settings as a JSON object string.
   * Shape: { quote: string, quotesJson: string, wallpaperPath: string }
   * Falls back to an empty-state object when native is unavailable.
   */
  async getOverlaySettings(): Promise<BlockOverlaySettings> {
    if (!has('getOverlaySettings')) {
      return { quote: '', quotesJson: '', wallpaperPath: '' };
    }
    try {
      const json: string = await BlockOverlay.getOverlaySettings();
      return JSON.parse(json) as BlockOverlaySettings;
    } catch {
      return { quote: '', quotesJson: '', wallpaperPath: '' };
    }
  },
};
