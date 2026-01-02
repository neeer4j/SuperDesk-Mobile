// Navigation setup for SuperDesk Mobile with Bottom Tabs and OTP Auth
import React, { useState, useEffect } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, StyleSheet, ActivityIndicator } from 'react-native';

// Screens
import LoginScreen from '../screens/LoginScreen';
import HostSessionScreen from '../screens/HostSessionScreen';
import JoinSessionScreen from '../screens/JoinSessionScreen';
import FileTransferScreen from '../screens/FileTransferScreen';
import FriendsScreen from '../screens/FriendsScreen';
import MessagesScreen from '../screens/MessagesScreen';
import SettingsScreen from '../screens/SettingsScreen';
import RemoteScreen from '../screens/RemoteScreen';
import SessionScreen from '../screens/SessionScreen';
import ChatScreen from '../screens/ChatScreen';

// Tab Navigator with Drawer
import TabsWithDrawer from '../components/TabsWithDrawer';

// Auth
import { authService } from '../services/supabaseClient';
import { useTheme } from '../context/ThemeContext';

// Type definitions
export type RootStackParamList = {
    Landing: undefined;
    Login: undefined;
    MainTabs: undefined;
    Remote: {
        sessionId: string;
        role: 'viewer' | 'host';
    };
    Session: {
        role: 'host';
        sessionId: string;
        guestId: string;
    };
    Settings: undefined;
    Chat: {
        userId: string;
        username: string;
    };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

import LandingScreen from '../screens/LandingScreen';

// Main Navigation with Auth State
const Navigation: React.FC = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const { theme, colors } = useTheme();

    useEffect(() => {
        checkAuth();

        // Listen for auth state changes
        const { data: { subscription } } = authService.onAuthStateChange((event, session) => {
            setIsAuthenticated(!!session);
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const checkAuth = async () => {
        try {
            const session = await authService.getSession();
            setIsAuthenticated(!!session);
        } catch (error) {
            setIsAuthenticated(false);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogin = () => {
        setIsAuthenticated(true);
    };

    const handleLogout = () => {
        setIsAuthenticated(false);
    };

    // ... theme config ...
    const baseTheme = theme === 'dark' ? DarkTheme : DefaultTheme;
    const navigationTheme = {
        ...baseTheme,
        colors: {
            ...baseTheme.colors,
            primary: colors.primary,
            background: colors.background,
            card: colors.card,
            text: colors.text,
            border: colors.border,
            notification: colors.error,
        },
    };

    if (isLoading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <NavigationContainer theme={navigationTheme}>
            <Stack.Navigator
                screenOptions={{
                    headerShown: false,
                    animation: 'slide_from_right',
                    contentStyle: { backgroundColor: colors.background },
                }}
                initialRouteName="Landing"
            >
                {/* Landing screen - acts as entry point */}
                <Stack.Screen name="Landing" component={LandingScreen} />

                {/* Login screen */}
                <Stack.Screen name="Login">
                    {(props) => <LoginScreen {...props} onLogin={handleLogin} />}
                </Stack.Screen>

                {/* Main app screens */}
                <Stack.Screen name="MainTabs" component={TabsWithDrawer} />
                <Stack.Screen
                    name="Remote"
                    options={{
                        animation: 'fade',
                        gestureEnabled: false,
                    }}
                >
                    {(props: any) => <RemoteScreen {...props} />}
                </Stack.Screen>
                <Stack.Screen name="Session">
                    {(props: any) => <SessionScreen {...props} />}
                </Stack.Screen>
                <Stack.Screen name="Settings">
                    {(props) => <SettingsScreen {...props} onLogout={handleLogout} />}
                </Stack.Screen>
                <Stack.Screen name="Chat">
                    {(props: any) => <ChatScreen {...props} />}
                </Stack.Screen>
            </Stack.Navigator>
        </NavigationContainer>
    );
};

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default Navigation;
