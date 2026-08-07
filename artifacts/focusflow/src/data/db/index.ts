/**
 * Database module - split into focused files for maintainability.
 * 
 * Import from this file to access all database functions:
 *   import { dbGetSettings, dbSaveSettings, dbGetTasksForDate, ... } from '@/data/db';
 */

// Connection & core utilities
export {
  getDb,
  resetDb,
  runWithDb,
  runWithDbOr,
  probeDbHealth,
  logDbDiagnostics,
} from './connection';

// Schema, migrations, and helpers
export {
  initSchema,
  migrateSettings,
  DEFAULT_SETTINGS,
  CURRENT_SCHEMA_VERSION,
  rowToTask,
  localDateString,
  parseLocalDate,
} from './schema';

// Task queries
export {
  dbGetAllTasks,
  dbGetRecentUnresolvedTasks,
  dbGetTasksInDateRange,
  dbGetTasksForDate,
  dbInsertTask,
  dbUpdateTask,
  dbUpdateTasksBatch,
  dbDeleteTask,
} from './taskQueries';

// Settings queries
export {
  dbGetSettings,
  dbSaveSettings,
} from './settingsQueries';

// Focus session queries
export {
  dbStartFocusSession,
  dbEndFocusSession,
  dbGetActiveFocusSession,
  dbGetTodayFocusMinutes,
  dbLogFocusOverride,
  dbGetTodayOverrideCount,
} from './focusSessionQueries';

// Stats / streak / pruning queries
export {
  dbRecordDayCompletion,
  dbBackfillDayCompletions,
  dbGetStreak,
  dbGetRecentDayCompletions,
  dbGetAllTimeFocusMinutes,
  dbGetAllTimeFocusSessions,
  dbGetBestStreak,
  dbPruneOldData,
  dbDeleteAllTasks,
  dbCheckpointWal,
} from './statsQueries';