// Navigation setup for SuperDesk Mobile with Bottom Tabs and OTP Auth
import React, { useState, useEffect } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, StyleSheet, ActivityIndicator } from 'react-native';

// Screens
import LoginScreen from '../screens/LoginScreen';
import LandingScreen from '../screens/LandingScreen';
import HostSessionScreen from '../screens/HostSessionScreen';
import JoinSessionScreen from '../screens/JoinSessionScreen';
import FileTransferScreen from '../screens/FileTransferScreen';
import FriendsScreen from '../screens/FriendsScreen';
import MessagesScreen from '../screens/MessagesScreen';
import SettingsScreen from '../screens/SettingsScreen';
import RemoteScreen from '../screens/RemoteScreen';
import SessionScreen from '../screens/SessionScreen';
import ChatScreen from '../screens/ChatScreen';

// Icons
import {
    HostIcon,
    JoinIcon,
    FileTransferIcon,
    FriendsIcon,
    MessagesIcon,
} from '../components/Icons';

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

export type TabParamList = {
    Host: undefined;
    Join: undefined;
    FileTransfer: undefined;
    Friends: undefined;
    Messages: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

// Bottom Tab Navigator
const TabNavigator: React.FC = () => {
    // Use dynamic theme colors
    const { colors } = useTheme();

    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarStyle: [styles.tabBar, {
                    backgroundColor: colors.surface,
                    borderTopColor: colors.border,
                    borderTopWidth: 1,
                    elevation: 0,
                }],
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.textTertiary,
                tabBarShowLabel: true,
                tabBarLabelStyle: styles.tabLabel,
                tabBarBackground: () => (
                    <View style={{ flex: 1, backgroundColor: colors.surface }} />
                ),
            }}
        >
            <Tab.Screen
                name="Host"
                component={HostSessionScreen}
                options={{
                    tabBarLabel: 'Host',
                    tabBarIcon: ({ color, size, focused }) => (
                        <HostIcon size={size} color={color} />
                    ),
                }}
            />
            <Tab.Screen
                name="Join"
                component={JoinSessionScreen}
                options={{
                    tabBarLabel: 'Join',
                    tabBarIcon: ({ color, size, focused }) => (
                        <JoinIcon size={size} color={color} />
                    ),
                }}
            />
            <Tab.Screen
                name="FileTransfer"
                component={FileTransferScreen}
                options={{
                    tabBarLabel: 'Files',
                    tabBarIcon: ({ color, size, focused }) => (
                        <FileTransferIcon size={size} color={color} />
                    ),
                }}
            />
            <Tab.Screen
                name="Friends"
                component={FriendsScreen}
                options={{
                    tabBarLabel: 'Friends',
                    tabBarIcon: ({ color, size, focused }) => (
                        <FriendsIcon size={size} color={color} />
                    ),
                }}
            />
            <Tab.Screen
                name="Messages"
                component={MessagesScreen}
                options={{
                    tabBarLabel: 'Chat',
                    tabBarIcon: ({ color, size, focused }) => (
                        <MessagesIcon size={size} color={color} />
                    ),
                }}
            />
        </Tab.Navigator>
    );
};

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

    // Define navigation themes based on our context
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
                {/* Landing screen - shows first, handles both logged in and logged out states */}
                <Stack.Screen name="Landing" component={LandingScreen} />

                {/* Login screen - only available when not authenticated */}
                {!isAuthenticated && (
                    <Stack.Screen name="Login">
                        {(props) => <LoginScreen {...props} onLogin={handleLogin} />}
                    </Stack.Screen>
                )}

                {/* Main app screens - only available when authenticated */}
                {isAuthenticated && (
                    <>
                        <Stack.Screen name="MainTabs" component={TabNavigator} />
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
                    </>
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
};

const styles = StyleSheet.create({
    tabBar: {
        borderTopWidth: 1,
        // Remove fixed height to let safe area logic handle it naturally if needed, 
        // but 60-70 is standard for modern apps
        height: 65,
        paddingTop: 8,
        paddingBottom: 8, // Will be overridden by safe area in sets but good default
    },
    tabLabel: {
        fontSize: 10,
        fontWeight: '500',
        marginTop: 4,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default Navigation;
