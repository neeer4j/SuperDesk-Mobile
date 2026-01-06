import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeType = 'light' | 'dark';

// Accent color presets
export type AccentColorKey = 'violet' | 'blue' | 'emerald' | 'rose' | 'amber' | 'cyan';

export interface AccentColor {
    name: string;
    primary: string;
    light: string; // lighter shade for backgrounds
    icon: string; // emoji or icon
}

export const accentColors: Record<AccentColorKey, AccentColor> = {
    violet: { name: 'Violet', primary: '#8b5cf6', light: 'rgba(139, 92, 246, 0.15)', icon: '💜' },
    blue: { name: 'Blue', primary: '#3b82f6', light: 'rgba(59, 130, 246, 0.15)', icon: '💙' },
    emerald: { name: 'Emerald', primary: '#10b981', light: 'rgba(16, 185, 129, 0.15)', icon: '💚' },
    rose: { name: 'Rose', primary: '#f43f5e', light: 'rgba(244, 63, 94, 0.15)', icon: '💗' },
    amber: { name: 'Amber', primary: '#f59e0b', light: 'rgba(245, 158, 11, 0.15)', icon: '🧡' },
    cyan: { name: 'Cyan', primary: '#06b6d4', light: 'rgba(6, 182, 212, 0.15)', icon: '💎' },
};

interface ThemeColors {
    background: string;
    card: string;
    cardGlass: string;
    text: string;
    subText: string;
    border: string;
    primary: string;
    error: string;
    success: string;
    warning: string;
    cardBorder: string;
    iconBackground: string;
    // Glass/Translucent colors
    glass: string;
    glassBorder: string;
    glassHighlight: string;
    tabBarGlass: string;
    surfaceGlass: string;
    // Legacy aliases for backward compatibility
    surface: string;
    surfaceHighlight: string;
    textPrimary: string;
    textSecondary: string;
    textTertiary: string;
}

const baseThemes: Record<ThemeType, Omit<ThemeColors, 'primary' | 'iconBackground' | 'surfaceHighlight'>> = {
    dark: {
        background: '#0a0a0f',
        card: 'rgba(20, 20, 28, 0.85)',
        cardGlass: 'rgba(20, 20, 28, 0.6)',
        text: '#ffffff',
        subText: '#888888',
        border: 'rgba(255, 255, 255, 0.08)',
        error: '#ef4444',
        success: '#10b981',
        warning: '#f59e0b',
        cardBorder: 'rgba(255, 255, 255, 0.06)',
        // Glass/Translucent colors
        glass: 'rgba(18, 18, 26, 0.75)',
        glassBorder: 'rgba(255, 255, 255, 0.1)',
        glassHighlight: 'rgba(255, 255, 255, 0.05)',
        tabBarGlass: 'rgba(12, 12, 18, 0.92)',
        surfaceGlass: 'rgba(25, 25, 35, 0.8)',
        // Legacy aliases
        surface: 'rgba(18, 18, 26, 0.9)',
        textPrimary: '#ffffff',
        textSecondary: '#888888',
        textTertiary: '#555555',
    },
    light: {
        background: '#FAFAFA',
        card: 'rgba(255, 255, 255, 0.9)',
        cardGlass: 'rgba(255, 255, 255, 0.7)',
        text: '#1A1A2E',
        subText: '#6B7280',
        border: 'rgba(0, 0, 0, 0.08)',
        error: '#EF4444',
        success: '#10B981',
        warning: '#f59e0b',
        cardBorder: 'rgba(0, 0, 0, 0.06)',
        // Glass/Translucent colors
        glass: 'rgba(255, 255, 255, 0.8)',
        glassBorder: 'rgba(0, 0, 0, 0.08)',
        glassHighlight: 'rgba(255, 255, 255, 0.6)',
        tabBarGlass: 'rgba(255, 255, 255, 0.95)',
        surfaceGlass: 'rgba(255, 255, 255, 0.85)',
        // Legacy aliases
        surface: 'rgba(255, 255, 255, 0.95)',
        textPrimary: '#1A1A2E',
        textSecondary: '#6B7280',
        textTertiary: '#9CA3AF',
    },
};

// Helper to build theme colors with accent
const buildThemeColors = (baseTheme: ThemeType, accent: AccentColor): ThemeColors => ({
    ...baseThemes[baseTheme],
    primary: accent.primary,
    iconBackground: accent.light,
    surfaceHighlight: accent.light,
});

interface ThemeContextType {
    theme: ThemeType;
    colors: ThemeColors;
    accentColor: AccentColorKey;
    toggleTheme: () => void;
    setTheme: (theme: ThemeType) => void;
    setAccentColor: (accent: AccentColorKey) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const systemColorScheme = useColorScheme();
    const [theme, setThemeState] = useState<ThemeType>('dark');
    const [accentColor, setAccentColorState] = useState<AccentColorKey>('violet');

    useEffect(() => {
        loadTheme();
    }, []);

    const loadTheme = async () => {
        try {
            const [storedTheme, storedAccent] = await Promise.all([
                AsyncStorage.getItem('app_theme'),
                AsyncStorage.getItem('app_accent_color'),
            ]);
            if (storedTheme === 'light' || storedTheme === 'dark') {
                setThemeState(storedTheme);
            }
            if (storedAccent && storedAccent in accentColors) {
                setAccentColorState(storedAccent as AccentColorKey);
            }
        } catch (error) {
            console.error('Failed to load theme:', error);
        }
    };

    const setTheme = async (newTheme: ThemeType) => {
        setThemeState(newTheme);
        try {
            await AsyncStorage.setItem('app_theme', newTheme);
        } catch (error) {
            console.error('Failed to save theme:', error);
        }
    };

    const setAccentColor = async (accent: AccentColorKey) => {
        setAccentColorState(accent);
        try {
            await AsyncStorage.setItem('app_accent_color', accent);
        } catch (error) {
            console.error('Failed to save accent color:', error);
        }
    };

    const toggleTheme = () => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
    };

    const colors = useMemo(() => 
        buildThemeColors(theme, accentColors[accentColor]), 
        [theme, accentColor]
    );

    return (
        <ThemeContext.Provider value={{ theme, colors, accentColor, toggleTheme, setTheme, setAccentColor }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
