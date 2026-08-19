import { moderateScale, scale, verticalScale } from 'react-native-size-matters';

export const COLORS = {
  primary: '#4F8EF7',
  primaryLight: '#1A2B4A',
  orange: '#F59E0B',
  orangeLight: '#3A2A10',
  green: '#22C55E',
  greenLight: '#12351F',
  red: '#EF4444',
  redLight: '#3A1518',
  blue: '#4F8EF7',
  blueLight: '#172B4D',
  purple: '#7C5CFF',
  purpleLight: '#241D4A',

  text: '#F5F7FF',
  textSecondary: '#B3B8CA',
  muted: '#7F879C',
  card: '#111421',
  surface: '#171A27',
  background: '#0A0A14',
  border: '#242A3A',

  // Dark
  darkText: '#F5F7FF',
  darkCard: '#111421',
  darkSurface: '#171A27',
  darkBackground: '#0A0A14',
  darkBorder: '#242A3A',
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
  xxl: moderateScale(32, 0.3),
  hero: moderateScale(44, 0.3),
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
  sm: { elevation: 1 },
  md: { elevation: 2 },
  lg: { elevation: 4 },
};

export const TASK_COLORS = [
  '#4F8EF7', // brand blue
  '#F59E0B', // amber
  '#22C55E', // protected
  '#EF4444', // breach
  '#4F8EF7', // blue
  '#7C5CFF', // violet
  '#22D3EE', // cyan
  '#14B8A6', // teal
];
