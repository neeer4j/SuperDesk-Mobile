// Navigation setup for SuperDesk Mobile with Bottom Tabs and OTP Auth
import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
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
    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarStyle: styles.tabBar,
                tabBarActiveTintColor: '#8b5cf6',
                tabBarInactiveTintColor: '#666',
                tabBarShowLabel: true,
                tabBarLabelStyle: styles.tabLabel,
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

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#8b5cf6" />
            </View>
        );
    }

    return (
        <NavigationContainer>
            <Stack.Navigator
                screenOptions={{
                    headerShown: false,
                    animation: 'slide_from_right',
                    contentStyle: { backgroundColor: '#0a0a0f' },
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
        backgroundColor: '#16161e',
        borderTopColor: '#2a2a3a',
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
        backgroundColor: '#0a0a0f',
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default Navigation;
