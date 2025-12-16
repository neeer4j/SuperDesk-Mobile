// Join Session Screen - Connect to a remote session with code
// Redesigned to use SessionManager for persistent sessions across tabs
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    StatusBar,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Share,
    Clipboard,
    Keyboard,
} from 'react-native';
import { SettingsIcon } from '../components/Icons';
import { sessionManager, SessionState } from '../services/SessionManager';
import { webRTCService } from '../services/WebRTCService';
import { socketService } from '../services/SocketService';
import { useTheme } from '../context/ThemeContext';

interface JoinSessionScreenProps {
    navigation: any;
}

type JoinStatus = 'idle' | 'connecting' | 'joining' | 'connected' | 'error';

const JoinSessionScreen: React.FC<JoinSessionScreenProps> = ({ navigation }) => {
    const { theme, colors } = useTheme();
    const [sessionCode, setSessionCode] = useState('');
    const [status, setStatus] = useState<JoinStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const [hostConnected, setHostConnected] = useState(false);

    useEffect(() => {
        // Initialize state from SessionManager - but verify socket is actually connected
        const state = sessionManager.getState();
        const isSocketConnected = socketService.isConnected();

        // Only show connected state if socket is actually connected
        if (state.isActive && state.role === 'guest' && isSocketConnected) {
            setSessionCode(state.sessionId || '');
            setStatus('connected');
            setHostConnected(true);
        } else if (state.isActive && state.role === 'guest' && !isSocketConnected) {
            // Stale state - socket disconnected but state persisted
            console.log('📱 Clearing stale session state - socket disconnected');
            sessionManager.endSession();
        }

        // Subscribe to session state changes
        const unsubscribe = sessionManager.subscribe((newState: SessionState, prevState: SessionState) => {
            if (newState.role === 'guest') {
                if (newState.isActive) {
                    setStatus('connected');
                    setSessionCode(newState.sessionId || '');
                    setHostConnected(true);
                }
            } else if (newState.role === null && prevState.role === 'guest') {
                // Session ended
                setStatus('idle');
                setSessionCode('');
                setHostConnected(false);
            }
        });

        // Listen for host disconnection
        const handleHostDisconnected = () => {
            Alert.alert('Host Disconnected', 'The host has ended the session.');
            setStatus('idle');
            setHostConnected(false);
        };
        sessionManager.on('hostDisconnected', handleHostDisconnected);

        // Listen for session ended
        const handleSessionEnded = () => {
            setStatus('idle');
            setHostConnected(false);
        };
        sessionManager.on('sessionEnded', handleSessionEnded);

        // Listen for errors
        const handleError = (errorMsg: string) => {
            setError(errorMsg);
            setStatus('error');
        };
        sessionManager.on('error', handleError);

        return () => {
            unsubscribe();
            sessionManager.off('hostDisconnected', handleHostDisconnected);
            sessionManager.off('sessionEnded', handleSessionEnded);
            sessionManager.off('error', handleError);
            // NOTE: We do NOT end the session on unmount anymore!
            // Session persists across tab navigation
        };
    }, [navigation]);

    const handleCodeChange = (text: string) => {
        // Remove any non-alphanumeric characters and convert to uppercase
        const cleaned = text.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        setSessionCode(cleaned);
        // Clear error when user starts typing
        if (error) {
            setError(null);
            setStatus('idle');
        }
    };

    const formatDisplayCode = (code: string) => {
        // Format as XXXX-XXXX for display
        if (code.length > 4) {
            return code.slice(0, 4) + '-' + code.slice(4);
        }
        return code;
    };

    const handleJoinSession = async () => {
        if (sessionCode.length !== 8) {
            Alert.alert('Invalid Code', 'Please enter the complete 8-character session code.');
            return;
        }

        setStatus('connecting');
        setError(null);

        try {
            // Join session
            await sessionManager.joinSession(sessionCode);
            console.log('✅ Joined session successfully');
            setStatus('connected');

            // Initialize WebRTC to be ready for file transfer data channel
            try {
                console.log('📱 Initializing WebRTC listener...');
                await webRTCService.initialize('viewer', sessionCode);
            } catch (err) {
                console.error('❌ Failed to init WebRTC:', err);
            }

            // Reset input
            setSessionCode('');
            Keyboard.dismiss(); // Dismiss keyboard on successful join

            // Set a timeout for if no response
            setTimeout(() => {
                if (status === 'joining') { // This condition might not be met if status is already 'connected'
                    setError('Connection timed out. Please check the session code and try again.');
                    setStatus('error');
                }
            }, 10000);

        } catch (err: any) {
            console.error('❌ Failed to join session:', err);
            setError(err.message || 'Failed to connect to server');
            setStatus('error');
        }
    };

    const handleViewRemote = () => {
        // Navigate to remote screen to view the host's screen
        // Get sessionId from sessionManager since local state might be cleared
        const state = sessionManager.getState();
        const currentSessionId = state.sessionId || sessionCode;

        if (!currentSessionId) {
            Alert.alert('Error', 'No session ID available. Please rejoin the session.');
            return;
        }

        navigation.navigate('Remote', {
            sessionId: currentSessionId,
            role: 'viewer',
        });
    };

    const handleDisconnect = () => {
        Alert.alert(
            'Disconnect',
            'Are you sure you want to leave this session?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Disconnect',
                    style: 'destructive',
                    onPress: () => {
                        sessionManager.endSession();
                    },
                },
            ]
        );
    };

    const getButtonText = () => {
        switch (status) {
            case 'connecting':
                return 'Connecting...';
            case 'joining':
                return 'Joining...';
            case 'connected':
                return 'Connected';
            default:
                return 'Join Session';
        }
    };

    const isButtonDisabled = sessionCode.length !== 8 || status === 'connecting' || status === 'joining' || status === 'connected';

    // Dynamic styles based on theme
    const dynamicStyles = {
        container: {
            backgroundColor: colors.background,
        },
        card: {
            backgroundColor: colors.card,
            borderColor: colors.cardBorder,
            shadowColor: theme === 'light' ? '#000' : 'transparent',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: theme === 'light' ? 0.08 : 0,
            shadowRadius: 8,
            elevation: theme === 'light' ? 3 : 0,
        },
        connectedCard: {
            borderColor: colors.success,
        },
        text: {
            color: colors.text,
        },
        subText: {
            color: colors.subText,
        },
        infoContainer: {
            backgroundColor: colors.card,
            borderColor: colors.cardBorder,
        },
        codeInput: {
            backgroundColor: theme === 'dark' ? '#1e1e2e' : '#F0EDFA',
            borderColor: theme === 'dark' ? '#3a3a4a' : colors.primary + '40',
            color: colors.text,
        },
    };

    return (
        <View style={[styles.container, dynamicStyles.container]}>
            <StatusBar
                barStyle={theme === 'dark' ? 'light-content' : 'dark-content'}
                backgroundColor={colors.background}
            />

            {/* Header with Settings */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Text style={[styles.logo, { color: colors.text }]}>SuperDesk</Text>
                </View>
                <TouchableOpacity
                    style={styles.settingsButton}
                    onPress={() => navigation.navigate('Settings')}
                >
                    <SettingsIcon size={24} color={colors.primary} />
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.content}
            >
                {status !== 'connected' ? (
                    <>
                        {/* Join Session Card */}
                        <View style={[styles.card, dynamicStyles.card]}>
                            <Text style={[styles.cardTitle, dynamicStyles.text]}>Join Remote Session</Text>
                            <Text style={[styles.cardDescription, dynamicStyles.subText]}>
                                Enter the 8-character session code from the host to connect and view their screen
                            </Text>

                            <View style={styles.codeInputContainer}>
                                <Text style={[styles.codeLabel, { color: colors.primary }]}>SESSION CODE</Text>
                                <TextInput
                                    style={[
                                        styles.codeInput,
                                        dynamicStyles.codeInput,
                                        error && { borderColor: colors.error },
                                    ]}
                                    placeholder="XXXX-XXXX"
                                    placeholderTextColor={colors.subText}
                                    value={formatDisplayCode(sessionCode)}
                                    onChangeText={handleCodeChange}
                                    maxLength={9} // 8 chars + hyphen
                                    autoCapitalize="characters"
                                    autoCorrect={false}
                                    keyboardType="default"
                                    editable={status !== 'connecting' && status !== 'joining'}
                                />
                                <Text style={[styles.codeHint, dynamicStyles.subText]}>
                                    {sessionCode.length}/8 characters
                                </Text>
                            </View>

                            {error && (
                                <View style={[styles.errorContainer, { backgroundColor: colors.error + '20' }]}>
                                    <Text style={[styles.errorText, { color: colors.error }]}>⚠️ {error}</Text>
                                </View>
                            )}

                            <TouchableOpacity
                                style={[
                                    styles.button,
                                    styles.primaryButton,
                                    { backgroundColor: colors.primary },
                                    isButtonDisabled && styles.buttonDisabled,
                                ]}
                                onPress={handleJoinSession}
                                disabled={isButtonDisabled}
                            >
                                {(status === 'connecting' || status === 'joining') ? (
                                    <View style={styles.buttonContent}>
                                        <ActivityIndicator size="small" color="#ffffff" />
                                        <Text style={[styles.buttonText, { marginLeft: 10 }]}>
                                            {getButtonText()}
                                        </Text>
                                    </View>
                                ) : (
                                    <Text style={styles.buttonText}>{getButtonText()}</Text>
                                )}
                            </TouchableOpacity>
                        </View>

                        {/* Info */}
                        <View style={[styles.infoContainer, dynamicStyles.infoContainer]}>
                            <Text style={[styles.infoTitle, { color: colors.primary }]}>How to connect:</Text>
                            <Text style={[styles.infoText, dynamicStyles.subText]}>1. Ask the host for their 8-character session code</Text>
                            <Text style={[styles.infoText, dynamicStyles.subText]}>2. Enter the code above</Text>
                            <Text style={[styles.infoText, dynamicStyles.subText]}>3. Tap "Join Session" to connect</Text>
                            <Text style={[styles.infoText, dynamicStyles.subText]}>4. Press "View Remote" to see and control their screen</Text>
                        </View>
                    </>
                ) : (
                    <>
                        {/* Connected Card */}
                        <View style={[styles.card, dynamicStyles.card, dynamicStyles.connectedCard]}>
                            <View style={[styles.connectedBadge, { backgroundColor: colors.success + '20' }]}>
                                <View style={[styles.connectedDot, { backgroundColor: colors.success }]} />
                                <Text style={[styles.connectedBadgeText, { color: colors.success }]}>Connected to Session</Text>
                            </View>

                            <Text style={[styles.sessionLabel, dynamicStyles.subText]}>SESSION CODE</Text>
                            <Text style={[styles.sessionCodeDisplay, dynamicStyles.text]}>{formatDisplayCode(sessionCode)}</Text>
                            <Text style={[styles.connectedHint, dynamicStyles.subText]}>
                                You're connected! Press "View Remote" to see and control the host's screen.
                            </Text>

                            {/* View Remote Button */}
                            <TouchableOpacity
                                style={[styles.button, styles.viewRemoteButton, { backgroundColor: colors.success }]}
                                onPress={handleViewRemote}
                            >
                                <Text style={styles.viewRemoteIcon}>🖥️</Text>
                                <Text style={styles.viewRemoteText}>View Remote Screen</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Disconnect Button */}
                        <TouchableOpacity
                            style={[styles.button, styles.disconnectButton, { borderColor: colors.error, backgroundColor: colors.error + '20' }]}
                            onPress={handleDisconnect}
                        >
                            <Text style={[styles.disconnectButtonText, { color: colors.error }]}>Disconnect</Text>
                        </TouchableOpacity>

                        {/* Tips */}
                        <View style={[styles.infoContainer, dynamicStyles.infoContainer]}>
                            <Text style={[styles.infoTitle, { color: colors.primary }]}>💡 Tips:</Text>
                            <Text style={[styles.infoText, dynamicStyles.subText]}>• You can navigate to other tabs while connected</Text>
                            <Text style={[styles.infoText, dynamicStyles.subText]}>• Go to Files tab to transfer files with the host</Text>
                            <Text style={[styles.infoText, dynamicStyles.subText]}>• Return here anytime to view their screen</Text>
                        </View>
                    </>
                )}
            </KeyboardAvoidingView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a0f',
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 20,
    },
    headerLeft: {
        flex: 1,
    },
    logo: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#ffffff',
    },
    settingsButton: {
        padding: 8,
    },
    content: {
        flex: 1,
    },
    card: {
        backgroundColor: '#16161e',
        borderRadius: 16,
        padding: 24,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#2a2a3a',
    },
    connectedCard: {
        borderColor: '#22c55e',
        borderWidth: 2,
    },
    cardTitle: {
        fontSize: 22,
        fontWeight: '600',
        color: '#ffffff',
        marginBottom: 8,
    },
    cardDescription: {
        fontSize: 14,
        color: '#888',
        marginBottom: 24,
        lineHeight: 22,
    },
    codeInputContainer: {
        marginBottom: 20,
    },
    codeLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#8b5cf6',
        marginBottom: 8,
        letterSpacing: 1,
    },
    codeInput: {
        backgroundColor: '#1e1e2e',
        borderRadius: 12,
        padding: 20,
        fontSize: 32,
        color: '#ffffff',
        textAlign: 'center',
        letterSpacing: 6,
        fontWeight: 'bold',
        borderWidth: 2,
        borderColor: '#3a3a4a',
    },
    codeInputError: {
        borderColor: '#ef4444',
    },
    codeHint: {
        fontSize: 12,
        color: '#666',
        textAlign: 'center',
        marginTop: 8,
    },
    errorContainer: {
        backgroundColor: '#ef444420',
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
    },
    errorText: {
        color: '#ef4444',
        fontSize: 14,
    },
    button: {
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
    },
    primaryButton: {
        backgroundColor: '#8b5cf6',
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    buttonContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    buttonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
    },
    connectedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#22c55e20',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        alignSelf: 'flex-start',
        marginBottom: 24,
    },
    connectedDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#22c55e',
        marginRight: 8,
    },
    connectedBadgeText: {
        color: '#22c55e',
        fontWeight: '600',
        fontSize: 14,
    },
    sessionLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#888',
        marginBottom: 8,
        textAlign: 'center',
        letterSpacing: 1,
    },
    sessionCodeDisplay: {
        fontSize: 36,
        fontWeight: 'bold',
        color: '#ffffff',
        textAlign: 'center',
        letterSpacing: 4,
        marginBottom: 16,
    },
    connectedHint: {
        fontSize: 14,
        color: '#888',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 20,
    },
    viewRemoteButton: {
        backgroundColor: '#22c55e',
        flexDirection: 'row',
        justifyContent: 'center',
    },
    viewRemoteIcon: {
        fontSize: 20,
        marginRight: 10,
    },
    viewRemoteText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
    },
    disconnectButton: {
        backgroundColor: '#ef444420',
        borderWidth: 1,
        borderColor: '#ef4444',
        marginBottom: 20,
    },
    disconnectButtonText: {
        color: '#ef4444',
        fontSize: 16,
        fontWeight: '600',
    },
    infoContainer: {
        backgroundColor: '#16161e',
        borderRadius: 12,
        padding: 20,
        borderWidth: 1,
        borderColor: '#2a2a3a',
    },
    infoTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#8b5cf6',
        marginBottom: 12,
    },
    infoText: {
        fontSize: 14,
        color: '#888',
        marginBottom: 8,
        lineHeight: 20,
    },
});

export default JoinSessionScreen;
