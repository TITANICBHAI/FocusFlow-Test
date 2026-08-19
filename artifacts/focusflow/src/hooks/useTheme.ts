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
        textSecondary: COLORS.textSecondary,
        muted: COLORS.muted,
        tabBar: COLORS.darkCard,
        tabBarBorder: COLORS.darkBorder,
        isDark: true,
      }
    : {
        background: '#F7F8FC',
        card: '#FFFFFF',
        surface: '#F0F2F7',
        border: '#DDE2EC',
        text: '#111318',
        textSecondary: '#596174',
        muted: '#7F879C',
        tabBar: '#FFFFFF',
        tabBarBorder: '#DDE2EC',
        isDark: false,
      };

  const toggleTheme = () => {
    updateSettings({ ...state.settings, darkMode: !isDark });
  };

  return { theme, isDark, toggleTheme };
}
