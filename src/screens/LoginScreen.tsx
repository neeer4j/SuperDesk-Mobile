// Simple, Clean Login Screen - Polished with curves and real icons
import React, { useState, useEffect } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    Alert,
    StatusBar,
    Image,
    View,
    Text,
    ActivityIndicator,
    StyleSheet,
    TouchableOpacity,
    TextInput,
} from 'react-native';
import { authService } from '../services/supabaseClient';
import { biometricService, BiometryType } from '../services/BiometricService';
import { hapticService } from '../services/HapticService';
import { useTheme } from '../context/ThemeContext';
import { layout } from '../theme/designSystem';

interface LoginScreenProps {
    navigation: any;
    onLogin: () => void;
}

type AuthStep = 'email' | 'otp' | 'biometric';

const LoginScreen: React.FC<LoginScreenProps> = ({ navigation, onLogin }) => {
    const { theme, colors } = useTheme();
    const [step, setStep] = useState<AuthStep>('email');
    const [email, setEmail] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [biometryType, setBiometryType] = useState<BiometryType | null>(null);
    const [isBiometricsReady, setIsBiometricsReady] = useState(false);
    const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);

    // Check biometric availability and auto-prompt on mount
    useEffect(() => {
        const checkBiometrics = async () => {
            console.log('📱 LoginScreen: Checking biometrics...');
            const type = await biometricService.checkAvailability();
            setBiometryType(type);

            if (type) {
                const isAuthRequired = await biometricService.isAuthRequired();
                console.log('📱 LoginScreen: Auth required?', isAuthRequired);

                if (isAuthRequired) {
                    setIsBiometricsReady(true);
                    setShowBiometricPrompt(true);
                    setStep('biometric');
                    // Auto-prompt after a short delay to let the UI render
                    setTimeout(() => handleBiometricLogin(), 500);
                }
            }
        };
        checkBiometrics();
    }, []);

    const handleBiometricLogin = async () => {
        hapticService.medium();
        setIsLoading(true);
        const success = await biometricService.authenticate('Login to SuperDesk');
        setIsLoading(false);
        if (success) {
            hapticService.success();
            onLogin();
            navigation.navigate('MainTabs');
        } else {
            hapticService.error();
            // If failed, show email login
            setStep('email');
            setShowBiometricPrompt(false);
        }
    };


    const handleSendOTP = async () => {
        hapticService.medium();
        if (!email || !email.includes('@')) {
            hapticService.error();
            Alert.alert('Error', 'Please enter a valid email address');
            return;
        }

        setIsLoading(true);
        try {
            await authService.sendOTP(email);
            hapticService.success();
            setStep('otp');
            Alert.alert('Code Sent', 'Check your email for the verification code');
        } catch (error: any) {
            hapticService.error();
            Alert.alert('Error', error.message || 'Failed to send verification code');
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyOTP = async () => {
        hapticService.heavy();
        if (!otpCode || otpCode.length < 6) {
            hapticService.error();
            Alert.alert('Error', 'Please enter the 6-digit code');
            return;
        }

        setIsLoading(true);
        try {
            await authService.verifyOTP(email, otpCode);
            onLogin();
            navigation.navigate('MainTabs');
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Invalid verification code');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={[styles.container, { backgroundColor: colors.background }]}
        >
            <StatusBar
                barStyle={theme === 'dark' ? 'light-content' : 'dark-content'}
                backgroundColor={colors.background}
            />

            <View style={styles.content}>
                {/* Logo at top */}
                <View style={styles.logoContainer}>
                    <Image
                        source={require('../assets/supp.png')}
                        style={styles.logoIcon}
                        resizeMode="contain"
                    />
                    <Image
                        source={theme === 'dark' ? require('../assets/superdeskw.png') : require('../assets/superdesk.png')}
                        style={styles.logoText}
                        resizeMode="contain"
                    />
                </View>

                {/* Heading */}
                <Text style={[styles.heading, { color: colors.text }]}>
                    {step === 'email' ? 'Welcome to SuperDesk' :
                        step === 'biometric' ? 'Authenticate' :
                            'Verify your email'}
                </Text>

                {/* Biometric Step - Fingerprint UI */}
                {step === 'biometric' && (
                    <View style={styles.biometricContainer}>
                        <TouchableOpacity
                            style={styles.fingerprintButton}
                            onPress={handleBiometricLogin}
                            activeOpacity={0.7}
                        >
                            <Image
                                source={require('../assets/fingerprint.png')}
                                style={[styles.fingerprintImage, { tintColor: colors.primary }]}
                                resizeMode="contain"
                            />
                        </TouchableOpacity>
                        <Text style={[styles.biometricHint, { color: colors.subText }]}>
                            {isLoading ? 'Authenticating...' : 'Tap to authenticate'}
                        </Text>
                        <TouchableOpacity
                            style={styles.usePasswordLink}
                            onPress={() => { setStep('email'); setShowBiometricPrompt(false); }}
                        >
                            <Text style={[styles.usePasswordText, { color: colors.primary }]}>
                                Use email instead
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Email Step */}
                {step === 'email' && (
                    <View style={styles.form}>
                        <TextInput
                            style={[styles.input, {
                                backgroundColor: colors.card,
                                borderColor: colors.border,
                                color: colors.text,
                                borderRadius: layout.borderRadius.lg,
                            }]}
                            placeholder="Enter your email"
                            placeholderTextColor={colors.subText}
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoComplete="email"
                        />

                        <TouchableOpacity
                            style={[styles.button, {
                                backgroundColor: colors.primary,
                                borderRadius: layout.borderRadius.lg,
                            }]}
                            onPress={handleSendOTP}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.buttonText}>Continue</Text>
                            )}
                        </TouchableOpacity>

                        <Text style={[styles.hint, { color: colors.subText }]}>
                            We'll send you a verification code
                        </Text>

                        {/* Biometric Login Button */}
                        {isBiometricsReady && biometryType && (
                            <TouchableOpacity
                                style={styles.biometricButton}
                                onPress={handleBiometricLogin}
                                activeOpacity={0.7}
                            >
                                <Image
                                    source={require('../assets/fingerprint.png')}
                                    style={[styles.fingerprintIcon, { tintColor: colors.primary }]}
                                    resizeMode="contain"
                                />
                                <Text style={[styles.biometricText, { color: colors.primary }]}>
                                    Login with {biometricService.getBiometryName(biometryType)}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}


                {/* OTP Step */}
                {step === 'otp' && (
                    <View style={styles.form}>
                        <Text style={[styles.otpHint, { color: colors.subText }]}>
                            Enter the 6-digit code sent to
                        </Text>
                        <Text style={[styles.emailDisplay, { color: colors.text }]}>
                            {email}
                        </Text>

                        <TextInput
                            style={[styles.otpInput, {
                                backgroundColor: colors.card,
                                borderColor: colors.border,
                                color: colors.text,
                                borderRadius: layout.borderRadius.lg,
                            }]}
                            placeholder="000000"
                            placeholderTextColor={colors.subText}
                            value={otpCode}
                            onChangeText={setOtpCode}
                            keyboardType="number-pad"
                            maxLength={6}
                        />

                        <TouchableOpacity
                            style={[styles.button, {
                                backgroundColor: colors.primary,
                                borderRadius: layout.borderRadius.lg,
                            }]}
                            onPress={handleVerifyOTP}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.buttonText}>Verify</Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.backLink}
                            onPress={() => setStep('email')}
                        >
                            <Text style={[styles.backLinkText, { color: colors.primary }]}>
                                ← Wrong email? Go back
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* Footer */}
            <View style={styles.footer}>
                <Text style={[styles.footerText, { color: colors.subText }]}>
                    SuperDesk Mobile v1.0
                </Text>
            </View>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    logoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 48,
    },
    logoIcon: {
        width: 48,
        height: 48,
        marginRight: 12,
    },
    logoText: {
        width: 160,
        height: 44,
    },
    heading: {
        fontSize: 28,
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: 32,
    },
    form: {
        width: '100%',
    },
    input: {
        height: 56,
        borderWidth: 1,
        paddingHorizontal: 20,
        fontSize: 16,
        marginBottom: 16,
    },
    otpInput: {
        height: 64,
        borderWidth: 1,
        paddingHorizontal: 16,
        fontSize: 28,
        fontWeight: '600',
        textAlign: 'center',
        letterSpacing: 8,
        marginBottom: 16,
        marginTop: 24,
    },
    button: {
        height: 56,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    hint: {
        fontSize: 14,
        textAlign: 'center',
        marginTop: 8,
    },
    otpHint: {
        fontSize: 14,
        textAlign: 'center',
    },
    emailDisplay: {
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
        marginTop: 4,
    },
    backLink: {
        paddingVertical: 12,
        alignItems: 'center',
    },
    backLinkText: {
        fontSize: 14,
        fontWeight: '500',
    },
    footer: {
        paddingVertical: 24,
        alignItems: 'center',
    },
    footerText: {
        fontSize: 12,
    },
    biometricButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 24,
        paddingVertical: 12,
    },
    fingerprintIcon: {
        width: 28,
        height: 28,
        marginRight: 10,
    },
    biometricText: {
        fontSize: 15,
        fontWeight: '600',
    },
    biometricContainer: {
        alignItems: 'center',
        marginTop: 24,
    },
    fingerprintButton: {
        padding: 20,
    },
    fingerprintImage: {
        width: 100,
        height: 100,
    },
    biometricHint: {
        fontSize: 16,
        marginTop: 16,
    },
    usePasswordLink: {
        marginTop: 32,
        paddingVertical: 12,
    },
    usePasswordText: {
        fontSize: 14,
        fontWeight: '500',
    },
});

export default LoginScreen;
