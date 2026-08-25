import { describe, expect, it, vi } from 'vitest';
import {
  analyzeScheduleHealth,
  compressSchedule,
  detectConflicts,
  insertTaskSafe,
  rebalanceAfterOverrun,
} from '@/services/schedulerEngine';
import { typedTask, task } from '../helpers/task';

describe('schedulerEngine', () => {
  it('detects only positive intersections and ignores the same, completed, and skipped tasks', () => {
    const incoming = task('new', '2026-08-24T10:00:00.000Z', '2026-08-24T11:00:00.000Z');
    const touching = task('touching', '2026-08-24T11:00:00.000Z', '2026-08-24T12:00:00.000Z');
    const overlap = task('overlap', '2026-08-24T10:30:00.000Z', '2026-08-24T11:30:00.000Z');
    const ignored = task('done', '2026-08-24T10:15:00.000Z', '2026-08-24T10:45:00.000Z', {
      status: 'completed',
    });

    expect(detectConflicts(incoming, [incoming, touching, overlap, ignored])).toEqual({
      hasConflict: true,
      conflicts: [{ task: overlap, overlapMinutes: 30 }],
    });
  });

  it('shifts lower-priority conflicts by the five-minute placement buffer', () => {
    vi.setSystemTime(new Date('2026-08-24T08:00:00.000Z'));
    const incoming = typedTask('new', '2026-08-24T10:00:00.000Z', '2026-08-24T11:00:00.000Z', 'high');
    const lower = typedTask('lower', '2026-08-24T10:30:00.000Z', '2026-08-24T11:30:00.000Z', 'low');
    const same = typedTask('same', '2026-08-24T10:45:00.000Z', '2026-08-24T11:15:00.000Z', 'high');

    const result = insertTaskSafe(incoming, [lower, same]);

    expect(result.task).toBe(incoming);
    expect(result.shifted).toHaveLength(1);
    expect(result.shifted[0]).toMatchObject({
      id: 'lower',
      startTime: '2026-08-24T11:05:00.000Z',
      endTime: '2026-08-24T12:05:00.000Z',
    });
  });

  it('leaves same- and higher-priority conflicts for explicit user resolution', () => {
    const incoming = typedTask('new', '2026-08-24T10:00:00.000Z', '2026-08-24T11:00:00.000Z', 'medium');
    const same = typedTask('same', '2026-08-24T10:15:00.000Z', '2026-08-24T11:15:00.000Z', 'medium');
    const higher = typedTask('higher', '2026-08-24T10:30:00.000Z', '2026-08-24T11:30:00.000Z', 'critical');

    const result = insertTaskSafe(incoming, [same, higher]);

    expect(result.task).toBe(incoming);
    expect(result.shifted).toEqual([]);
  });

  it('does not shift tasks that finished before an inserted task', () => {
    const incoming = typedTask('new', '2026-08-24T10:00:00.000Z', '2026-08-24T11:00:00.000Z', 'high');
    const earlier = typedTask('earlier', '2026-08-24T08:00:00.000Z', '2026-08-24T09:00:00.000Z', 'low');

    const result = insertTaskSafe(incoming, [earlier]);

    expect(result.shifted).toEqual([]);
  });

  it('protects critical tasks and shifts high-priority tasks after an overrun', () => {
    vi.setSystemTime(new Date('2026-08-24T08:00:00.000Z'));
    const overrun = typedTask('overrun', '2026-08-24T09:00:00.000Z', '2026-08-24T10:00:00.000Z', 'high');
    const critical = typedTask('critical', '2026-08-24T10:00:00.000Z', '2026-08-24T11:00:00.000Z', 'critical');
    const high = typedTask('high', '2026-08-24T11:00:00.000Z', '2026-08-24T12:00:00.000Z', 'high');

    const result = rebalanceAfterOverrun(overrun, 20, [overrun, critical, high]);

    expect(result.needsUserConfirm.map(({ id }) => id)).toEqual(['critical']);
    expect(result.shifted[0]).toMatchObject({
      id: 'high',
      startTime: '2026-08-24T11:20:00.000Z',
      endTime: '2026-08-24T12:20:00.000Z',
    });
  });

  it('does not change the schedule for zero or negative overruns', () => {
    const overrun = typedTask('overrun', '2026-08-24T09:00:00.000Z', '2026-08-24T10:00:00.000Z', 'high');
    const next = typedTask('next', '2026-08-24T10:00:00.000Z', '2026-08-24T11:00:00.000Z', 'low');

    for (const minutes of [0, -5]) {
      const result = rebalanceAfterOverrun(overrun, minutes, [overrun, next]);
      expect(result.updatedSchedule).toEqual([next]);
      expect(result.shifted).toEqual([]);
      expect(result.skipped).toEqual([]);
      expect(result.needsUserConfirm).toEqual([]);
    }
  });

  it('compresses only later unresolved tasks after an early completion', () => {
    vi.setSystemTime(new Date('2026-08-24T12:00:00.000Z'));
    const completed = task('completed', '2026-08-24T09:00:00.000Z', '2026-08-24T10:00:00.000Z');
    const later = task('later', '2026-08-24T11:00:00.000Z', '2026-08-24T12:00:00.000Z');
    const skipped = task('skipped', '2026-08-24T11:30:00.000Z', '2026-08-24T12:30:00.000Z', {
      status: 'skipped',
    });

    const result = compressSchedule(completed, '2026-08-24T09:40:00.000Z', [completed, later, skipped]);

    expect(result[1].startTime).toBe('2026-08-24T10:40:00.000Z');
    expect(result[1].endTime).toBe('2026-08-24T11:40:00.000Z');
    expect(result[2]).toBe(skipped);
  });

  it('leaves the schedule unchanged when completion was not early', () => {
    const completed = task('completed', '2026-08-24T09:00:00.000Z', '2026-08-24T10:00:00.000Z');
    const later = task('later', '2026-08-24T11:00:00.000Z', '2026-08-24T12:00:00.000Z');
    const schedule = [completed, later];

    expect(compressSchedule(completed, '2026-08-24T10:00:00.000Z', schedule)).toBe(schedule);
    expect(compressSchedule(completed, '2026-08-24T10:30:00.000Z', schedule)).toBe(schedule);
  });

  it('reports overlaps and gaps using chronological order', () => {
    const first = task('first', '2026-08-24T09:00:00.000Z', '2026-08-24T10:00:00.000Z');
    const overlap = task('overlap', '2026-08-24T09:45:00.000Z', '2026-08-24T10:15:00.000Z');
    const gap = task('gap', '2026-08-24T10:40:00.000Z', '2026-08-24T11:00:00.000Z');

    const result = analyzeScheduleHealth([gap, overlap, first]);

    expect(result.overlaps.map(({ a, b }) => [a.id, b.id])).toEqual([['first', 'overlap']]);
    expect(result.gaps).toEqual([{ afterTask: overlap, gapMinutes: 25 }]);
    expect(result.totalScheduledMinutes).toBe(90);
  });
});