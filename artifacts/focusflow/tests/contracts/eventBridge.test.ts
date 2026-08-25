import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { addListener, remove, emit, NativeEventEmitter } = vi.hoisted(() => {
  let listener: ((event: unknown) => void) | undefined;
  const remove = vi.fn(() => {
    listener = undefined;
  });
  const addListener = vi.fn((_name: string, handler: (event: unknown) => void) => {
    listener = handler;
    return { remove };
  });
  const emit = (event: unknown) => listener?.(event);
  class NativeEventEmitter {
    addListener = addListener;
  }
  return { addListener, remove, emit, NativeEventEmitter };
});

vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
  NativeModules: { FocusDayBridge: {} },
  NativeEventEmitter,
}));

import { EventBridge } from '@/services/eventBridge';

describe('EventBridge React↔native event contract', () => {
  beforeEach(() => {
    EventBridge.destroy();
    addListener.mockClear();
    remove.mockClear();
  });

  afterEach(() => {
    EventBridge.destroy();
  });

  it('dispatches supported native events only to subscribers of that type', () => {
    const tickHandler = vi.fn();
    const blockedHandler = vi.fn();
    EventBridge.subscribe('TASK_TICK', tickHandler);
    EventBridge.subscribe('APP_BLOCKED', blockedHandler);
    EventBridge.init();

    emit({
      type: 'TASK_TICK',
      taskId: 'task-1',
      taskName: 'Deep work',
      remainingSeconds: 90,
    });

    expect(tickHandler).toHaveBeenCalledWith({
      type: 'TASK_TICK',
      taskId: 'task-1',
      taskName: 'Deep work',
      remainingSeconds: 90,
    });
    expect(blockedHandler).not.toHaveBeenCalled();
  });

  it('supports notification action payloads without changing their exact identifiers', () => {
    const handler = vi.fn();
    EventBridge.subscribe('NOTIF_ACTION', handler);
    EventBridge.init();

    emit({
      type: 'NOTIF_ACTION',
      taskId: 'task-2',
      notifAction: 'EXTEND',
      minutes: 15,
    });

    expect(handler).toHaveBeenCalledWith({
      type: 'NOTIF_ACTION',
      taskId: 'task-2',
      notifAction: 'EXTEND',
      minutes: 15,
    });
  });

  it('isolates handler failures so later handlers still receive the event', () => {
    const first = vi.fn(() => {
      throw new Error('handler failure');
    });
    const second = vi.fn();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    EventBridge.subscribe('FOCUS_STOP', first);
    EventBridge.subscribe('FOCUS_STOP', second);
    EventBridge.init();

    emit({ type: 'FOCUS_STOP', taskId: 'task-3' });

    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledWith(
      '[EventBridge] Handler error for',
      'FOCUS_STOP',
      expect.any(Error),
    );
    error.mockRestore();
  });

  it('unsubscribes individual handlers and removes the native listener on destroy', () => {
    const handler = vi.fn();
    const unsubscribe = EventBridge.subscribe('TASK_ENDED', handler);
    EventBridge.init();
    unsubscribe();
    emit({ type: 'TASK_ENDED', taskId: 'task-4' });

    expect(handler).not.toHaveBeenCalled();
    EventBridge.destroy();
    expect(remove).toHaveBeenCalledOnce();
  });
});