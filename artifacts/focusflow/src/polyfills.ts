/**
 * Polyfills for JavaScript features missing from older Hermes builds.
 *
 * Must be imported FIRST in _layout.tsx before any other import
 * so libraries (expo-sqlite, React internals) can rely on these globals.
 */

// WeakRef — available in Hermes 0.12+ (RN 0.70+).
// Older emulators / CI Hermes builds may ship without it.
if (typeof WeakRef === 'undefined') {
  (global as any).WeakRef = class WeakRef<T extends object> {
    private _target: T;
    constructor(target: T) {
      this._target = target;
    }
    deref(): T | undefined {
      return this._target;
    }
  };
}

// FinalizationRegistry — companion to WeakRef, used by expo-sqlite
// for connection lifecycle management.
if (typeof FinalizationRegistry === 'undefined') {
  (global as any).FinalizationRegistry = class FinalizationRegistry<T> {
    constructor(_callback: (heldValue: T) => void) {}
    register(_target: object, _heldValue: T, _unregisterToken?: object): void {}
    unregister(_unregisterToken: object): void {}
  };
}
