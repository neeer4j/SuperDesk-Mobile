// Navigation setup for SuperDesk Mobile with Bottom Tabs and OTP Auth
import React, { useState, useEffect } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
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
    const { colors } = useTheme();
    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarStyle: [styles.tabBar, {
                    backgroundColor: colors.card,
                    borderTopColor: colors.border
                }],
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.subText,
                tabBarShowLabel: true,
                tabBarLabelStyle: styles.tabLabel,
                tabBarBackground: () => (
                    <View style={{ flex: 1, backgroundColor: colors.card }} />
                ),
            }}
        >
            <Tab.Screen
                name="Host"
                component={HostSessionScreen}
                options={{
                    tabBarLabel: 'Host',
                    tabBarIcon: ({ color, size }) => (
                        <HostIcon size={size} color={color} />
                    ),
                }}
            />
            <Tab.Screen
                name="Join"
                component={JoinSessionScreen}
                options={{
                    tabBarLabel: 'Join',
                    tabBarIcon: ({ color, size }) => (
                        <JoinIcon size={size} color={color} />
                    ),
                }}
            />
            <Tab.Screen
                name="FileTransfer"
                component={FileTransferScreen}
                options={{
                    tabBarLabel: 'Files',
                    tabBarIcon: ({ color, size }) => (
                        <FileTransferIcon size={size} color={color} />
                    ),
                }}
            />
            <Tab.Screen
                name="Friends"
                component={FriendsScreen}
                options={{
                    tabBarLabel: 'Friends',
                    tabBarIcon: ({ color, size }) => (
                        <FriendsIcon size={size} color={color} />
                    ),
                }}
            />
            <Tab.Screen
                name="Messages"
                component={MessagesScreen}
                options={{
                    tabBarLabel: 'Chat',
                    tabBarIcon: ({ color, size }) => (
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
            >
                {!isAuthenticated ? (
                    <Stack.Screen name="Login">
                        {(props) => <LoginScreen {...props} onLogin={handleLogin} />}
                    </Stack.Screen>
                ) : (
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
        height: 70,
        paddingBottom: 10,
        paddingTop: 10,
    },
    tabLabel: {
        fontSize: 11,
        fontWeight: '500',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default Navigation;
