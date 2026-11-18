import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_STORAGE_KEY = 'app_theme';

const darkColors = {
  isDark: true,
  bgPrimary: '#07090e',
  bg: '#090b14',
  bgSurface: '#0c101b',
  card: 'rgba(255, 255, 255, 0.04)',
  cardBg: 'rgba(255, 255, 255, 0.04)',
  cardBgModal: '#0c101b',
  cardHover: 'rgba(255, 255, 255, 0.07)',
  cardBorder: 'rgba(255, 255, 255, 0.08)',
  border: 'rgba(255, 255, 255, 0.08)',
  borderSubtle: 'rgba(255, 255, 255, 0.06)',
  borderFocus: '#E8B020',
  text: '#ffffff',
  textMain: '#ffffff',
  textSecondary: '#94a3b8',
  textSub: '#94a3b8',
  textMuted: '#64748b',
  gold: '#E8B020',
  goldHover: '#F5D070',
  goldBg: 'rgba(232, 176, 32, 0.12)',
  goldDim: 'rgba(232, 176, 32, 0.12)',
  goldBorder: 'rgba(232, 176, 32, 0.35)',
  goldGradient: ['#E8B020', '#C9930A'],
  green: '#4ADE80',
  greenDim: 'rgba(74, 222, 128, 0.12)',
  greenBorder: 'rgba(74, 222, 128, 0.35)',
  success: '#4ADE80',
  successBg: 'rgba(74, 222, 128, 0.12)',
  successBorder: 'rgba(74, 222, 128, 0.35)',
  red: '#EF4444',
  redDim: 'rgba(239, 68, 68, 0.12)',
  redBorder: 'rgba(239, 68, 68, 0.35)',
  danger: '#EF4444',
  dangerBg: 'rgba(239, 68, 68, 0.12)',
  dangerBorder: 'rgba(239, 68, 68, 0.35)',
  inputBg: 'rgba(0, 0, 0, 0.4)',
  inputBorder: 'rgba(255, 255, 255, 0.12)',
  modalOverlay: 'rgba(7, 9, 14, 0.88)',
  modalCard: '#0c101b',
  statusBar: 'light',
};

const lightColors = {
  isDark: false,
  bgPrimary: '#f1f5f9',
  bg: '#f8fafc',
  bgSurface: '#ffffff',
  card: '#ffffff',
  cardBg: '#ffffff',
  cardBgModal: '#ffffff',
  cardHover: '#f1f5f9',
  cardBorder: '#e2e8f0',
  border: '#cbd5e1',
  borderSubtle: '#e2e8f0',
  borderFocus: '#D97706',
  text: '#0f172a',
  textMain: '#0f172a',
  textSecondary: '#475569',
  textSub: '#475569',
  textMuted: '#64748b',
  gold: '#D97706',
  goldHover: '#B45309',
  goldBg: 'rgba(217, 119, 6, 0.1)',
  goldDim: 'rgba(217, 119, 6, 0.1)',
  goldBorder: 'rgba(217, 119, 6, 0.3)',
  goldGradient: ['#D97706', '#B45309'],
  green: '#16A34A',
  greenDim: 'rgba(22, 163, 74, 0.1)',
  greenBorder: 'rgba(22, 163, 74, 0.3)',
  success: '#16A34A',
  successBg: 'rgba(22, 163, 74, 0.1)',
  successBorder: 'rgba(22, 163, 74, 0.3)',
  red: '#DC2626',
  redDim: 'rgba(220, 38, 38, 0.1)',
  redBorder: 'rgba(220, 38, 38, 0.3)',
  danger: '#DC2626',
  dangerBg: 'rgba(220, 38, 38, 0.1)',
  dangerBorder: 'rgba(220, 38, 38, 0.3)',
  inputBg: '#ffffff',
  inputBorder: '#cbd5e1',
  modalOverlay: 'rgba(15, 23, 42, 0.65)',
  modalCard: '#ffffff',
  statusBar: 'dark',
};

const ThemeContext = createContext({
  themeMode: 'system',
  isDark: true,
  colors: darkColors,
  setThemeMode: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme(); // 'light' | 'dark' | null
  const [themeMode, setThemeModeState] = useState('system'); // 'system' | 'dark' | 'light'

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved && ['system', 'dark', 'light'].includes(saved)) {
          setThemeModeState(saved);
        }
      } catch (err) {
        console.log('[Theme] Failed to load theme preference:', err.message);
      }
    })();
  }, []);

  const setThemeMode = useCallback(async (mode) => {
    if (!['system', 'dark', 'light'].includes(mode)) return;
    setThemeModeState(mode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (err) {
      console.log('[Theme] Failed to persist theme preference:', err.message);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    // If currently dark, switch to light; if light, switch to dark
    const currentlyDark = themeMode === 'system' ? systemScheme !== 'light' : themeMode === 'dark';
    const nextMode = currentlyDark ? 'light' : 'dark';
    setThemeMode(nextMode);
  }, [themeMode, systemScheme, setThemeMode]);

  const isDark = useMemo(() => {
    if (themeMode === 'system') {
      return systemScheme !== 'light';
    }
    return themeMode === 'dark';
  }, [themeMode, systemScheme]);

  const colors = useMemo(() => {
    return isDark ? darkColors : lightColors;
  }, [isDark]);

  const value = useMemo(() => ({
    themeMode,
    isDark,
    colors,
    setThemeMode,
    toggleTheme,
  }), [themeMode, isDark, colors, setThemeMode, toggleTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
