import { moderateScale, scale, verticalScale } from 'react-native-size-matters';

export const COLORS = {
  primary: '#6366f1',
  primaryLight: '#e0e7ff',
  orange: '#f59e0b',
  orangeLight: '#fef3c7',
  green: '#10b981',
  greenLight: '#d1fae5',
  red: '#ef4444',
  redLight: '#fee2e2',
  blue: '#3b82f6',
  blueLight: '#dbeafe',
  purple: '#8b5cf6',
  purpleLight: '#ede9fe',

  text: '#1e1b4b',
  textSecondary: '#6b7280',
  muted: '#9ca3af',
  card: '#ffffff',
  surface: '#f5f5f5',
  background: '#f0f2ff',
  border: '#e5e7eb',

  // Dark
  darkText: '#f3f4f6',
  darkCard: '#1f2937',
  darkSurface: '#374151',
  darkBackground: '#111827',
  darkBorder: '#374151',
};

/**
 * Font sizes — moderateScale with factor 0.3 so text grows gently on larger
 * screens without blowing up on 10" tablets.
 */
export const FONT = {
  xs: moderateScale(11, 0.3),
  sm: moderateScale(13, 0.3),
  md: moderateScale(15, 0.3),
  lg: moderateScale(18, 0.3),
  xl: moderateScale(22, 0.3),
  xxl: moderateScale(28, 0.3),
};

/**
 * Border radii — very gentle scaling so corners don't look overly round on
 * large phones/tablets.
 */
export const RADIUS = {
  sm: moderateScale(6, 0.25),
  md: moderateScale(10, 0.25),
  lg: moderateScale(16, 0.25),
  xl: moderateScale(24, 0.25),
  full: 999,
};

/**
 * Spacing (padding / margin / gap) — scale() for horizontal, verticalScale()
 * for vertical. Where a value is used for both axes moderateScale is a safe
 * middle ground.
 */
export const SPACING = {
  xs: moderateScale(4),
  sm: moderateScale(8),
  md: moderateScale(12),
  lg: moderateScale(16),
  xl: moderateScale(24),
  xxl: moderateScale(32),
};

export const SHADOW = {
  sm: { elevation: 2 },
  md: { elevation: 4 },
  lg: { elevation: 8 },
};

export const TASK_COLORS = [
  '#6366f1', // indigo
  '#f59e0b', // amber
  '#10b981', // emerald
  '#ef4444', // red
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#84cc16', // lime
];
