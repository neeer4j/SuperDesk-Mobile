import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeType = 'light' | 'dark';

interface ThemeColors {
    background: string;
    card: string;
    text: string;
    subText: string;
    border: string;
    primary: string;
    error: string;
    success: string;
    cardBorder: string;
    iconBackground: string;
}

export const themes: Record<ThemeType, ThemeColors> = {
    dark: {
        background: '#0a0a0f',
        card: '#16161e',
        text: '#ffffff',
        subText: '#888888',
        border: '#2a2a3a',
        primary: '#8b5cf6',
        error: '#ef4444',
        success: '#10b981',
        cardBorder: '#2a2a3a',
        iconBackground: 'rgba(139, 92, 246, 0.2)', // #8b5cf620
    },
    light: {
        background: '#FFFFFF',           // Pure white main background
        card: '#F8F7FF',                  // Subtle purple-tinted white for cards
        text: '#1A1A2E',                  // Dark purple-tinted text for better harmony
        subText: '#6B7280',               // Neutral grey for secondary text
        border: '#E8E5F0',                // Soft purple-grey border
        primary: '#8b5cf6',               // Same purple as dark mode for consistency
        error: '#EF4444',
        success: '#10B981',
        cardBorder: '#E0DCF0',            // Subtle purple-tinted border for cards
        iconBackground: 'rgba(139, 92, 246, 0.12)', // Light purple tint for icon backgrounds
    },
};

interface ThemeContextType {
    theme: ThemeType;
    colors: ThemeColors;
    toggleTheme: () => void;
    setTheme: (theme: ThemeType) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const systemColorScheme = useColorScheme();
    const [theme, setThemeState] = useState<ThemeType>('dark');
    // Defaulting to dark initially to match previous app behavior, 
    // will check storage subsequently.

    useEffect(() => {
        loadTheme();
    }, []);

    const loadTheme = async () => {
        try {
            const storedTheme = await AsyncStorage.getItem('app_theme');
            if (storedTheme === 'light' || storedTheme === 'dark') {
                setThemeState(storedTheme);
            } else {
                // If no preference, could default to system or stick to 'dark' as default
                // setThemeState(systemColorScheme === 'light' ? 'light' : 'dark');
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

    const toggleTheme = () => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
    };

    return (
        <ThemeContext.Provider value={{ theme, colors: themes[theme], toggleTheme, setTheme }}>
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
