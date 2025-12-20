import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StatusBar,
    Animated,
    Easing,
    Image,
    StyleSheet,
    ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/Navigation';
import { typography, layout } from '../theme/designSystem';
import { authService, UserProfile } from '../services/supabaseClient';
import { useTheme } from '../context/ThemeContext';

interface UserState {
    isLoggedIn: boolean;
    profile: UserProfile | null;
    isLoading: boolean;
}

const LandingScreen = () => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { theme, colors } = useTheme();

    const [userState, setUserState] = useState<UserState>({
        isLoggedIn: false,
        profile: null,
        isLoading: true,
    });

    // Simple fade-in animation
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current;

    useEffect(() => {
        checkAuthStatus();
    }, []);

    useEffect(() => {
        if (!userState.isLoading) {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 600,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 600,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [userState.isLoading]);

    const checkAuthStatus = async () => {
        try {
            const session = await authService.getSession();
            if (session) {
                const profile = await authService.getUserProfile();
                setUserState({
                    isLoggedIn: true,
                    profile,
                    isLoading: false,
                });
            } else {
                setUserState({
                    isLoggedIn: false,
                    profile: null,
                    isLoading: false,
                });
            }
        } catch (error) {
            console.log('Auth check error:', error);
            setUserState({
                isLoggedIn: false,
                profile: null,
                isLoading: false,
            });
        }
    };

    const handleGetStarted = () => {
        navigation.navigate('Login');
    };

    const handleContinue = () => {
        navigation.navigate('MainTabs');
    };

    // Get first letter for avatar placeholder
    const getAvatarLetter = () => {
        if (userState.profile?.username) {
            return userState.profile.username.charAt(0).toUpperCase();
        }
        if (userState.profile?.email) {
            return userState.profile.email.charAt(0).toUpperCase();
        }
        return '?';
    };

    // Generate a consistent color based on the username
    const getAvatarColor = () => {
        const avatarColors = ['#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#10b981'];
        const name = userState.profile?.username || userState.profile?.email || '';
        const index = name.charCodeAt(0) % avatarColors.length;
        return avatarColors[index] || avatarColors[0];
    };

    if (userState.isLoading) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <StatusBar
                    barStyle={theme === 'dark' ? 'light-content' : 'dark-content'}
                    backgroundColor={colors.background}
                />
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar
                barStyle={theme === 'dark' ? 'light-content' : 'dark-content'}
                backgroundColor={colors.background}
            />

            {userState.isLoggedIn && userState.profile ? (
                /* ===== LOGGED IN LAYOUT ===== */
                <>
                    <Animated.View
                        style={[
                            styles.centeredContent,
                            {
                                opacity: fadeAnim,
                                transform: [{ translateY: slideAnim }],
                            },
                        ]}
                    >
                        {/* Avatar */}
                        {userState.profile.avatar_url ? (
                            <Image
                                source={{ uri: userState.profile.avatar_url }}
                                style={styles.avatarLarge}
                            />
                        ) : (
                            <View style={[styles.avatarPlaceholderLarge, { backgroundColor: getAvatarColor() }]}>
                                <Text style={styles.avatarLetterLarge}>{getAvatarLetter()}</Text>
                            </View>
                        )}

                        {/* User Info */}
                        <Text style={[styles.welcomeText, { color: colors.subText }]}>Welcome back,</Text>
                        <Text style={[styles.usernameMain, { color: colors.text }]}>@{userState.profile.username}</Text>
                        {userState.profile.email && (
                            <Text style={[styles.emailMain, { color: colors.subText }]}>{userState.profile.email}</Text>
                        )}

                        {/* Continue Button */}
                        <TouchableOpacity
                            style={[styles.buttonWide, { backgroundColor: colors.primary }]}
                            onPress={handleContinue}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.buttonText}>Continue</Text>
                        </TouchableOpacity>

                        {/* Switch Account Option */}
                        <TouchableOpacity
                            style={styles.switchAccountButton}
                            onPress={handleGetStarted}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.switchAccountText, { color: colors.subText }]}>Switch Account</Text>
                        </TouchableOpacity>
                    </Animated.View>

                    {/* Footer with branding */}
                    <View style={styles.footerBranding}>
                        <Text style={[styles.footerAppName, { color: colors.text }]}>SuperDesk</Text>
                        <Text style={[styles.footerTagline, { color: colors.subText }]}>Remote desktop, simplified.</Text>
                        <Text style={[styles.versionText, { color: colors.subText }]}>v1.0</Text>
                    </View>
                </>
            ) : (
                /* ===== NOT LOGGED IN LAYOUT ===== */
                <>
                    <Animated.View
                        style={[
                            styles.centeredContent,
                            {
                                opacity: fadeAnim,
                                transform: [{ translateY: slideAnim }],
                            },
                        ]}
                    >
                        {/* Logo */}
                        <Image
                            source={require('../assets/supp.png')}
                            style={styles.logoLarge}
                            resizeMode="contain"
                        />

                        {/* App Name */}
                        <Text style={[styles.appNameLarge, { color: colors.text }]}>SuperDesk</Text>

                        {/* Tagline */}
                        <Text style={[styles.taglineMain, { color: colors.subText }]}>
                            Remote desktop, simplified.
                        </Text>

                        {/* Get Started Button */}
                        <TouchableOpacity
                            style={[styles.buttonWide, { backgroundColor: colors.primary }]}
                            onPress={handleGetStarted}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.buttonText}>Get Started</Text>
                        </TouchableOpacity>
                    </Animated.View>

                    {/* Version Footer */}
                    <Text style={[styles.versionFooter, { color: colors.subText }]}>v1.0</Text>
                </>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: layout.spacing.xl,
    },
    centeredContent: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    // ===== LOGGED IN STYLES =====
    avatarLarge: {
        width: 100,
        height: 100,
        borderRadius: 50,
        marginBottom: layout.spacing.lg,
    },
    avatarPlaceholderLarge: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: layout.spacing.lg,
    },
    avatarLetterLarge: {
        fontSize: 40,
        fontFamily: typography.fontFamily.bold,
        color: '#FFFFFF',
    },
    welcomeText: {
        fontSize: typography.size.sm,
        fontFamily: typography.fontFamily.regular,
        marginBottom: layout.spacing.xs,
    },
    usernameMain: {
        fontSize: typography.size.xl,
        fontFamily: typography.fontFamily.bold,
        marginBottom: layout.spacing.xs,
    },
    emailMain: {
        fontSize: typography.size.sm,
        fontFamily: typography.fontFamily.regular,
        marginBottom: layout.spacing.xl,
    },
    buttonWide: {
        paddingHorizontal: 60,
        paddingVertical: layout.spacing.md,
        borderRadius: layout.borderRadius.lg,
        marginTop: layout.spacing.md,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: typography.size.md,
        fontFamily: typography.fontFamily.semiBold,
    },
    switchAccountButton: {
        marginTop: layout.spacing.lg,
        padding: layout.spacing.sm,
    },
    switchAccountText: {
        fontSize: typography.size.sm,
        fontFamily: typography.fontFamily.regular,
    },
    footerBranding: {
        position: 'absolute',
        bottom: layout.spacing.xl,
        alignItems: 'center',
    },
    footerAppName: {
        fontSize: typography.size.md,
        fontFamily: typography.fontFamily.semiBold,
        marginBottom: 4,
    },
    footerTagline: {
        fontSize: typography.size.sm,
        fontFamily: typography.fontFamily.regular,
        marginBottom: layout.spacing.sm,
    },
    versionText: {
        fontSize: typography.size.xs,
        fontFamily: typography.fontFamily.regular,
    },
    // ===== NOT LOGGED IN STYLES =====
    logoLarge: {
        width: 120,
        height: 120,
        marginBottom: layout.spacing.xl,
    },
    appNameLarge: {
        fontSize: 36,
        fontFamily: typography.fontFamily.bold,
        letterSpacing: -0.5,
        marginBottom: layout.spacing.sm,
    },
    taglineMain: {
        fontSize: typography.size.md,
        fontFamily: typography.fontFamily.regular,
        marginBottom: layout.spacing.xxl,
    },
    versionFooter: {
        position: 'absolute',
        bottom: layout.spacing.xl,
        fontSize: typography.size.xs,
        fontFamily: typography.fontFamily.regular,
    },
});

export default LandingScreen;
