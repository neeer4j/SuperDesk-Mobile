// Updated Tab Navigator with Drawer Integration

import { Logger } from '../utils/Logger';
// Updated Tab Navigator with Drawer Integration
import React, { useState, useEffect, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet, Image, Text, Dimensions } from 'react-native';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Animated, {
    useAnimatedStyle,
    withSpring,
    withTiming,
    useSharedValue,
    interpolate,
    Extrapolate,
    FadeIn,
    FadeOut,
    SlideInRight,
    SlideOutLeft,
} from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { layout, typography } from '../theme/designSystem';

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
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TAB_COUNT = 5;
const TAB_WIDTH = SCREEN_WIDTH / TAB_COUNT;

// Animated Tab Item
interface AnimatedTabItemProps {
    isFocused: boolean;
    label: string;
    icon: React.ReactNode;
    activeIcon: React.ReactNode;
    onPress: () => void;
    onLongPress: () => void;
    color: string;
    activeColor: string;
}

const AnimatedTabItem: React.FC<AnimatedTabItemProps> = ({
    isFocused,
    label,
    icon,
    activeIcon,
    onPress,
    onLongPress,
    color,
    activeColor,
}) => {
    const scale = useSharedValue(1);
    const translateY = useSharedValue(0);

    useEffect(() => {
        if (isFocused) {
            scale.value = withSpring(1.15, { damping: 12, stiffness: 200 });
            translateY.value = withSpring(-2, { damping: 12, stiffness: 200 });
        } else {
            scale.value = withSpring(1, { damping: 12, stiffness: 200 });
            translateY.value = withSpring(0, { damping: 12, stiffness: 200 });
        }
    }, [isFocused]);

    const animatedIconStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: scale.value },
            { translateY: translateY.value },
        ],
    }));

    const animatedLabelStyle = useAnimatedStyle(() => ({
        opacity: withTiming(isFocused ? 1 : 0.6, { duration: 200 }),
        transform: [{ scale: withTiming(isFocused ? 1 : 0.95, { duration: 200 }) }],
    }));

    return (
        <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={label}
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.tabItem}
            activeOpacity={0.7}
        >
            <Animated.View style={animatedIconStyle}>
                {isFocused ? activeIcon : icon}
            </Animated.View>
            <Animated.Text
                style={[
                    styles.tabLabel,
                    { color: isFocused ? activeColor : color },
                    animatedLabelStyle,
                ]}
            >
                {label}
            </Animated.Text>
        </TouchableOpacity>
    );
};

// Custom Tab Bar with animations
const CustomTabBar: React.FC<BottomTabBarProps & { colors: any }> = ({
    state,
    descriptors,
    navigation,
    colors,
}) => {
    const indicatorPosition = useSharedValue(state.index * TAB_WIDTH);

    useEffect(() => {
        indicatorPosition.value = withSpring(state.index * TAB_WIDTH, {
            damping: 15,
            stiffness: 150,
        });
    }, [state.index]);

    const indicatorStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: indicatorPosition.value }],
    }));

    const tabIcons: Record<string, { icon: (color: string) => React.ReactNode; label: string }> = {
        Host: { icon: (c) => <HostIcon size={22} color={c} />, label: 'Host' },
        Join: { icon: (c) => <JoinIcon size={22} color={c} />, label: 'Join' },
        FileTransfer: { icon: (c) => <FileTransferIcon size={22} color={c} />, label: 'Files' },
        Friends: { icon: (c) => <FriendsIcon size={22} color={c} />, label: 'Friends' },
        Messages: { icon: (c) => <MessagesIcon size={22} color={c} />, label: 'Chat' },
    };

    return (
        <View style={[styles.tabBar, { backgroundColor: colors.tabBarGlass, borderTopColor: colors.glassBorder }]}>
            {/* Animated indicator */}
            <Animated.View
                style={[
                    styles.tabIndicator,
                    { backgroundColor: colors.primary + '20' },
                    indicatorStyle,
                ]}
            />

            {state.routes.map((route, index) => {
                const { options } = descriptors[route.key];
                const isFocused = state.index === index;
                const tabConfig = tabIcons[route.name];

                const onPress = () => {
                    const event = navigation.emit({
                        type: 'tabPress',
                        target: route.key,
                        canPreventDefault: true,
                    });

                    if (!isFocused && !event.defaultPrevented) {
                        navigation.navigate(route.name);
                    }
                };

                const onLongPress = () => {
                    navigation.emit({
                        type: 'tabLongPress',
                        target: route.key,
                    });
                };

                return (
                    <AnimatedTabItem
                        key={route.key}
                        isFocused={isFocused}
                        label={tabConfig.label}
                        icon={tabConfig.icon(colors.textTertiary)}
                        activeIcon={tabConfig.icon(colors.primary)}
                        onPress={onPress}
                        onLongPress={onLongPress}
                        color={colors.textTertiary}
                        activeColor={colors.primary}
                    />
                );
            })}
        </View>
    );
};

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
                tabBar={(props) => <CustomTabBar {...props} colors={colors} />}
                screenOptions={{
                    headerShown: true,
                    lazy: false, // Pre-load all screens to avoid loading flicker
                    headerStyle: {
                        backgroundColor: colors.background,
                        borderBottomWidth: 0,
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
                <Tab.Screen name="Host" component={HostSessionScreen} />
                <Tab.Screen name="Join" component={JoinSessionScreen} />
                <Tab.Screen name="FileTransfer" component={FileTransferScreen} />
                <Tab.Screen name="Friends" component={FriendsScreen} />
                <Tab.Screen name="Messages" component={MessagesScreen} />
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
        flexDirection: 'row',
        borderTopWidth: 1,
        height: 70,
        paddingTop: 8,
        paddingBottom: 12,
        position: 'relative',
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 4,
    },
    tabLabel: {
        fontSize: 10,
        fontWeight: '600',
        marginTop: 4,
    },
    tabIndicator: {
        position: 'absolute',
        top: 4,
        width: TAB_WIDTH - 16,
        height: 48,
        borderRadius: 12,
        marginHorizontal: 8,
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
