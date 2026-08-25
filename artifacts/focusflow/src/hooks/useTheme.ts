import { useApp } from '@/context/AppContext';
import { COLORS } from '@/styles/theme';

export function useTheme() {
  const { state, updateSettings } = useApp();
  const isDark = state.settings.darkMode ?? false;

  const theme = isDark
    ? {
        background: COLORS.darkBackground,
        card: COLORS.darkCard,
        surface: COLORS.darkSurface,
        border: COLORS.darkBorder,
        text: COLORS.darkText,
        textSecondary: '#9ca3af',
        muted: '#6b7280',
        tabBar: COLORS.darkCard,
        tabBarBorder: COLORS.darkBorder,
        isDark: true,
      }
    : {
        background: COLORS.background,
        card: COLORS.card,
        surface: COLORS.surface,
        border: COLORS.border,
        text: COLORS.text,
        textSecondary: COLORS.textSecondary,
        muted: COLORS.muted,
        tabBar: '#ffffff',
        tabBarBorder: '#e5e7eb',
        isDark: false,
      };

  const toggleTheme = () => {
    updateSettings({ ...state.settings, darkMode: !isDark });
  };

  return { theme, isDark, toggleTheme };
}
