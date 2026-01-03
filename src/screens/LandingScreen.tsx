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
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/Navigation';
import { typography, layout } from '../theme/designSystem';
import { authService, UserProfile } from '../services/supabaseClient';
import { biometricService, BiometryType } from '../services/BiometricService';
import { hapticService } from '../services/HapticService';
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
    const [biometryType, setBiometryType] = useState<BiometryType | null>(null);
    const [biometricsRequired, setBiometricsRequired] = useState(false);
    const [isAuthenticating, setIsAuthenticating] = useState(false);

    // Enhanced animations
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;
    const scaleAnim = useRef(new Animated.Value(0.9)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const rotateAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        checkAuthStatus();
    }, []);

    useEffect(() => {
        if (!userState.isLoading) {
            // Logo and content entrance
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 800,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
                Animated.spring(slideAnim, {
                    toValue: 0,
                    tension: 40,
                    friction: 7,
                    useNativeDriver: true,
                }),
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    tension: 40,
                    friction: 7,
                    useNativeDriver: true,
                }),
            ]).start();

            // Pulsing button animation
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.05,
                        duration: 1500,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 1500,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                ])
            ).start();

            // Slow rotation for decorative element
            Animated.loop(
                Animated.timing(rotateAnim, {
                    toValue: 1,
                    duration: 20000,
                    easing: Easing.linear,
                    useNativeDriver: true,
                })
            ).start();
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

                // Check biometrics availability and requirement
                const type = await biometricService.checkAvailability();
                setBiometryType(type);
                if (type) {
                    const isRequired = await biometricService.isAuthRequired();
                    setBiometricsRequired(isRequired);
                }
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

    const handleContinue = async () => {
        hapticService.medium();
        if (biometricsRequired) {
            setIsAuthenticating(true);
            const success = await biometricService.authenticate('Authenticate to continue');
            setIsAuthenticating(false);
            if (success) {
                hapticService.success();
                navigation.navigate('MainTabs');
            } else {
                hapticService.error();
            }
        } else {
            navigation.navigate('MainTabs');
        }
    };

    const handleBiometricAuth = async () => {
        hapticService.medium();
        setIsAuthenticating(true);
        const success = await biometricService.authenticate('Authenticate to continue');
        setIsAuthenticating(false);
        if (success) {
            hapticService.success();
            navigation.navigate('MainTabs');
        } else {
            hapticService.error();
        }
    };

    const getAvatarLetter = () => {
        if (userState.profile?.username) {
            return userState.profile.username.charAt(0).toUpperCase();
        }
        if (userState.profile?.email) {
            return userState.profile.email.charAt(0).toUpperCase();
        }
        return '?';
    };

    const getAvatarColor = () => {
        const avatarColors = ['#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#10b981'];
        const name = userState.profile?.username || userState.profile?.email || '';
        const index = name.charCodeAt(0) % avatarColors.length;
        return avatarColors[index] || avatarColors[0];
    };

    const spin = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

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

            {/* Decorative background circles */}
            <Animated.View
                style={[
                    styles.decorativeCircle1,
                    {
                        backgroundColor: colors.primary,
                        transform: [{ rotate: spin }],
                    }
                ]}
            />
            <Animated.View
                style={[
                    styles.decorativeCircle2,
                    {
                        backgroundColor: colors.primary,
                        transform: [{ rotate: spin }],
                    }
                ]}
            />

            {userState.isLoggedIn && userState.profile ? (
                /* ===== LOGGED IN LAYOUT ===== */
                <>
                    <Animated.View
                        style={[
                            styles.centeredContent,
                            {
                                opacity: fadeAnim,
                                transform: [
                                    { translateY: slideAnim },
                                    { scale: scaleAnim }
                                ],
                            },
                        ]}
                    >
                        {/* Avatar with enhanced styling */}
                        <View style={styles.avatarContainer}>
                            {userState.profile.avatar_url ? (
                                <Image
                                    source={{ uri: userState.profile.avatar_url }}
                                    style={styles.avatarLarge}
                                />
                            ) : (
                                <LinearGradient
                                    colors={[getAvatarColor(), getAvatarColor() + 'CC']}
                                    style={styles.avatarPlaceholderLarge}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                >
                                    <Text style={styles.avatarLetterLarge}>{getAvatarLetter()}</Text>
                                </LinearGradient>
                            )}
                            <View style={[styles.avatarRing, { borderColor: colors.primary }]} />
                        </View>

                        {/* User Info */}
                        <Text style={[styles.welcomeText, { color: colors.subText }]}>Welcome back,</Text>
                        <Text style={[styles.usernameMain, { color: colors.text }]}>@{userState.profile.username}</Text>
                        {userState.profile.email && (
                            <Text style={[styles.emailMain, { color: colors.subText }]}>{userState.profile.email}</Text>
                        )}

                        {/* Enhanced Continue Button */}
                        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                            <TouchableOpacity
                                style={styles.buttonContainer}
                                onPress={handleContinue}
                                activeOpacity={0.9}
                                disabled={isAuthenticating}
                            >
                                <LinearGradient
                                    colors={[colors.primary, colors.primary + 'DD']}
                                    style={styles.buttonWide}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                >
                                    {isAuthenticating ? (
                                        <ActivityIndicator color="#FFFFFF" />
                                    ) : (
                                        <Text style={styles.buttonText}>Continue</Text>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </Animated.View>

                        {/* Fingerprint Button - for in-screen fingerprint devices */}
                        {biometricsRequired && biometryType && (
                            <TouchableOpacity
                                style={styles.fingerprintTouchArea}
                                onPress={handleBiometricAuth}
                                activeOpacity={0.7}
                            >
                                <Image
                                    source={require('../assets/fingerprint.png')}
                                    style={[styles.fingerprintIcon, { tintColor: colors.primary }]}
                                    resizeMode="contain"
                                />
                                <Text style={[styles.fingerprintHint, { color: colors.subText }]}>
                                    Tap to authenticate
                                </Text>
                            </TouchableOpacity>
                        )}

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
                        <Image
                            source={theme === 'dark' ? require('../assets/superdeskw.png') : require('../assets/superdesk.png')}
                            style={styles.footerLogo}
                            resizeMode="contain"
                        />
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
                                transform: [
                                    { translateY: slideAnim },
                                    { scale: scaleAnim }
                                ],
                            },
                        ]}
                    >
                        {/* Logo and App Name Row */}
                        <View style={styles.logoRow}>
                            <View style={styles.logoContainerSmall}>
                                <View style={[styles.logoGlowSmall, { backgroundColor: colors.primary }]} />
                                <Image
                                    source={require('../assets/supp.png')}
                                    style={styles.logoSmall}
                                    resizeMode="contain"
                                />
                            </View>

                            <Image
                                source={theme === 'dark' ? require('../assets/superdeskw.png') : require('../assets/superdesk.png')}
                                style={styles.logoTextSmall}
                                resizeMode="contain"
                            />
                        </View>

                        {/* Tagline */}
                        <Text style={[styles.taglineMain, { color: colors.subText }]}>
                            Remote desktop, simplified.
                        </Text>

                        {/* Enhanced Get Started Button */}
                        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                            <TouchableOpacity
                                style={styles.buttonContainer}
                                onPress={handleGetStarted}
                                activeOpacity={0.9}
                            >
                                <LinearGradient
                                    colors={[colors.primary, colors.primary + 'DD']}
                                    style={styles.buttonWide}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                >
                                    <Text style={styles.buttonText}>Get Started</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </Animated.View>
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
        overflow: 'hidden',
    },
    centeredContent: {
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1,
    },
    // Decorative elements
    decorativeCircle1: {
        position: 'absolute',
        width: 300,
        height: 300,
        borderRadius: 150,
        top: -150,
        right: -100,
        opacity: 0.05,
    },
    decorativeCircle2: {
        position: 'absolute',
        width: 200,
        height: 200,
        borderRadius: 100,
        bottom: -80,
        left: -60,
        opacity: 0.08,
    },
    // ===== LOGGED IN STYLES =====
    avatarContainer: {
        position: 'relative',
        marginBottom: layout.spacing.lg,
    },
    avatarLarge: {
        width: 110,
        height: 110,
        borderRadius: 55,
        borderWidth: 4,
        borderColor: '#FFFFFF',
    },
    avatarPlaceholderLarge: {
        width: 110,
        height: 110,
        borderRadius: 55,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 4,
        borderColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 10,
    },
    avatarRing: {
        position: 'absolute',
        width: 126,
        height: 126,
        borderRadius: 63,
        borderWidth: 2,
        top: -8,
        left: -8,
        opacity: 0.3,
    },
    avatarLetterLarge: {
        fontSize: 44,
        fontFamily: typography.fontFamily.bold,
        color: '#FFFFFF',
    },
    welcomeText: {
        fontSize: typography.size.md,
        fontFamily: typography.fontFamily.regular,
        marginBottom: layout.spacing.xs,
        opacity: 0.8,
    },
    usernameMain: {
        fontSize: typography.size.xxl,
        fontFamily: typography.fontFamily.bold,
        marginBottom: layout.spacing.xs,
    },
    emailMain: {
        fontSize: typography.size.sm,
        fontFamily: typography.fontFamily.regular,
        marginBottom: layout.spacing.xxl,
        opacity: 0.7,
    },
    buttonContainer: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    buttonWide: {
        paddingHorizontal: 64,
        paddingVertical: 16,
        borderRadius: 30,
        marginTop: layout.spacing.md,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: typography.size.md,
        fontFamily: typography.fontFamily.bold,
        textAlign: 'center',
        letterSpacing: 0.5,
    },
    switchAccountButton: {
        marginTop: layout.spacing.xl,
        padding: layout.spacing.sm,
    },
    switchAccountText: {
        fontSize: typography.size.sm,
        fontFamily: typography.fontFamily.medium,
        opacity: 0.7,
    },
    footerBranding: {
        position: 'absolute',
        bottom: layout.spacing.xl,
        alignItems: 'center',
    },
    footerLogo: {
        width: 225,
        height: 62,
        marginBottom: layout.spacing.sm,
        opacity: 0.9,
    },
    versionText: {
        fontSize: typography.size.xs,
        fontFamily: typography.fontFamily.regular,
        opacity: 0.5,
    },
    // ===== NOT LOGGED IN STYLES =====
    logoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: layout.spacing.xl,
    },
    logoContainerSmall: {
        position: 'relative',
        marginRight: layout.spacing.md,
    },
    logoSmall: {
        width: 60,
        height: 60,
    },
    logoGlowSmall: {
        position: 'absolute',
        width: 70,
        height: 70,
        borderRadius: 35,
        opacity: 0.2,
        top: -5,
        left: -5,
    },
    logoTextSmall: {
        width: 180,
        height: 50,
    },
    taglineMain: {
        fontSize: typography.size.lg,
        fontFamily: typography.fontFamily.medium,
        marginBottom: layout.spacing.xxl,
        opacity: 0.8,
    },
    versionFooter: {
        position: 'absolute',
        bottom: layout.spacing.xl,
        fontSize: typography.size.xs,
        fontFamily: typography.fontFamily.regular,
        opacity: 0.5,
    },
    fingerprintTouchArea: {
        alignItems: 'center',
        marginTop: layout.spacing.lg,
        paddingVertical: layout.spacing.md,
    },
    fingerprintIcon: {
        width: 60,
        height: 60,
    },
    fingerprintHint: {
        fontSize: typography.size.sm,
        marginTop: layout.spacing.sm,
    },
});

export default LandingScreen;
