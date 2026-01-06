// Updated Tab Navigator with Drawer Integration

import { Logger } from '../utils/Logger';
// Updated Tab Navigator with Drawer Integration
import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme } from '../context/ThemeContext';
import { layout } from '../theme/designSystem';

// Screens
import HostSessionScreen from '../screens/HostSessionScreen';
import JoinSessionScreen from '../screens/JoinSessionScreen';
import FileTransferScreen from '../screens/FileTransferScreen';
import FriendsScreen from '../screens/FriendsScreen';
import MessagesScreen from '../screens/MessagesScreen';

// Icons
import {
    HostIcon,
    JoinIcon,
    FileTransferIcon,
    FriendsIcon,
    MessagesIcon,
    MenuIcon,
} from './Icons';

// Drawer
import SideDrawer from './SideDrawer';
import { authService } from '../services/supabaseClient';

export type TabParamList = {
    Host: undefined;
    Join: undefined;
    FileTransfer: undefined;
    Friends: undefined;
    Messages: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

interface TabsWithDrawerProps {
    navigation: any;
}

const TabsWithDrawer: React.FC<TabsWithDrawerProps> = ({ navigation }) => {
    const { colors, theme } = useTheme();
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [userProfile, setUserProfile] = useState<any>(null);

    useEffect(() => {
        loadUserProfile();
    }, []);

    const loadUserProfile = async () => {
        try {
            const profile = await authService.getUserProfile();
            setUserProfile(profile);
        } catch (error) {
            Logger.debug('Failed to load profile:', error);
        }
    };

    return (
        <>
            <Tab.Navigator
                screenOptions={{
                    headerShown: true,
                    tabBarStyle: [styles.tabBar, {
                        backgroundColor: colors.surface,
                        borderTopColor: colors.border,
                    }],
                    tabBarActiveTintColor: colors.primary,
                    tabBarInactiveTintColor: colors.textTertiary,
                    tabBarShowLabel: true,
                    tabBarLabelStyle: styles.tabLabel,
                    headerStyle: {
                        backgroundColor: colors.background,
                        borderBottomColor: colors.border,
                        borderBottomWidth: 1,
                        elevation: 0,
                        shadowOpacity: 0,
                    },
                    headerTitleStyle: {
                        color: colors.text,
                        fontSize: 18,
                        fontWeight: '600',
                    },
                    headerLeft: () => (
                        <TouchableOpacity
                            style={styles.menuButton}
                            onPress={() => setIsDrawerOpen(true)}
                        >
                            <MenuIcon size={24} color={colors.text} />
                        </TouchableOpacity>
                    ),
                    headerTitle: () => (
                        <Image
                            source={theme === 'dark' ? require('../assets/superdeskw.png') : require('../assets/superdesk.png')}
                            style={styles.headerLogo}
                            resizeMode="contain"
                        />
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

            <SideDrawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                onOpen={() => setIsDrawerOpen(true)}
                navigation={navigation}
                userProfile={userProfile}
            />
        </>
    );
};

const styles = StyleSheet.create({
    tabBar: {
        borderTopWidth: 1,
        height: 65,
        paddingTop: 8,
        paddingBottom: 8,
    },
    tabLabel: {
        fontSize: 10,
        fontWeight: '500',
        marginTop: 4,
    },
    menuButton: {
        marginLeft: 16,
        padding: 8,
    },
    headerLogo: {
        width: 140,
        height: 38,
    },
});

export default TabsWithDrawer;
