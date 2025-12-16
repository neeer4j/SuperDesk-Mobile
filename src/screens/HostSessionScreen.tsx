// Host Session Screen - Share your device screen with session code
// Redesigned to use SessionManager for persistent sessions across tabs
import React, { useState, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    StatusBar,
    Share,
    Clipboard,
    Alert,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { SettingsIcon } from '../components/Icons';
import { sessionManager, SessionState } from '../services/SessionManager';
import { webRTCService } from '../services/WebRTCService';
import { useTheme } from '../context/ThemeContext';

interface HostSessionScreenProps {
    navigation: any;
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'session-active' | 'guest-connected';

const HostSessionScreen: React.FC<HostSessionScreenProps> = ({ navigation }) => {
    const { theme, colors } = useTheme();
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
    const [sessionCode, setSessionCode] = useState('');
    const [guestId, setGuestId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isScreenSharing, setIsScreenSharing] = useState(false);

    useEffect(() => {
        // Initialize state from SessionManager
        const state = sessionManager.getState();
        if (state.isActive && state.role === 'host') {
            setSessionCode(state.sessionId || '');
            setGuestId(state.peerId);
            setConnectionStatus(state.peerId ? 'guest-connected' : 'session-active');
            setIsScreenSharing(state.isScreenSharing);
        }

        // Subscribe to session state changes
        const unsubscribe = sessionManager.subscribe((newState: SessionState, prevState: SessionState) => {
            if (newState.role === 'host' || newState.role === null) {
                if (!newState.isActive) {
                    setConnectionStatus('disconnected');
                    setSessionCode('');
                    setGuestId(null);
                    setIsScreenSharing(false);
                } else {
                    setSessionCode(newState.sessionId || '');
                    setGuestId(newState.peerId);
                    setConnectionStatus(newState.peerId ? 'guest-connected' : 'session-active');
                    setIsScreenSharing(newState.isScreenSharing);
                }
            }
        });

        // Listen for guest joined event
        const handleGuestJoined = (data: { guestId: string; sessionId: string }) => {
            console.log('📱 Guest joined:', data.guestId);
            setGuestId(data.guestId);
            setConnectionStatus('guest-connected');

            // AUTOMATICALLY Initialize WebRTC connection for file transfer
            const initDataConnection = async () => {
                try {
                    console.log('📱 Initializing WebRTC data connection...');
                    await webRTCService.initialize('host', data.sessionId);

                    // Wait a moment for initialization
                    await new Promise(r => setTimeout(r, 500));

                    // Create offer to establish data channel
                    await webRTCService.createOffer();
                    console.log('📱 Data connection offer sent');
                } catch (err) {
                    console.error('❌ Failed to init data connection:', err);
                }
            };

            initDataConnection();
        };
        sessionManager.on('guestJoined', handleGuestJoined);

        // Listen for errors
        const handleError = (errorMsg: string) => {
            setError(errorMsg);
            setConnectionStatus('disconnected');
        };
        sessionManager.on('error', handleError);

        // Listen for session ended
        const handleSessionEnded = () => {
            setConnectionStatus('disconnected');
            setSessionCode('');
            setGuestId(null);
            setIsScreenSharing(false);
        };
        sessionManager.on('sessionEnded', handleSessionEnded);

        return () => {
            unsubscribe();
            sessionManager.off('guestJoined', handleGuestJoined);
            sessionManager.off('error', handleError);
            sessionManager.off('sessionEnded', handleSessionEnded);
            // NOTE: We do NOT end the session on unmount anymore!
            // Session persists across tab navigation
        };
    }, []);

    const handleStartHosting = async () => {
        setConnectionStatus('connecting');
        setError(null);

        try {
            await sessionManager.createSession();
        } catch (err: any) {
            console.error('❌ Failed to start hosting:', err);
            setError(err.message || 'Failed to connect to server');
            setConnectionStatus('disconnected');
        }
    };

    const handleStopHosting = () => {
        Alert.alert(
            'End Session',
            'Are you sure you want to end the session? This will disconnect any connected guests.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'End Session',
                    style: 'destructive',
                    onPress: () => {
                        sessionManager.endSession();
                    },
                },
            ]
        );
    };

    const handleShareScreen = () => {
        // Navigate to Session screen which will request screen capture permission
        if (!guestId) {
            Alert.alert(
                'No Guest Connected',
                'Wait for someone to join your session before sharing your screen.',
                [{ text: 'OK' }]
            );
            return;
        }

        navigation.navigate('Session', {
            role: 'host',
            sessionId: sessionCode,
            guestId: guestId,
        });
    };

    const handleCopyCode = useCallback(() => {
        Clipboard.setString(sessionCode);
        Alert.alert('Copied!', 'Session code copied to clipboard');
    }, [sessionCode]);

    const handleShareCode = useCallback(async () => {
        try {
            await Share.share({
                message: `Join my SuperDesk session with code: ${sessionCode}`,
                title: 'SuperDesk Session Code',
            });
        } catch (err: any) {
            Alert.alert('Error', 'Failed to share code');
        }
    }, [sessionCode]);

    const handleRefreshCode = useCallback(async () => {
        if (!sessionCode) return;

        try {
            setConnectionStatus('connecting');
            await sessionManager.refreshSessionCode();
        } catch (err: any) {
            setError(err.message || 'Failed to refresh code');
        }
    }, [sessionCode]);

    const formatCode = (code: string) => {
        if (code.length >= 8) {
            return code.slice(0, 4) + '-' + code.slice(4, 8);
        }
        return code;
    };

    const getStatusText = () => {
        switch (connectionStatus) {
            case 'connecting':
                return 'Connecting to server...';
            case 'session-active':
                return 'Waiting for someone to join...';
            case 'guest-connected':
                return isScreenSharing ? 'Screen sharing active' : 'Guest connected! Ready to share screen';
            default:
                return '';
        }
    };

    const isHosting = connectionStatus === 'session-active' || connectionStatus === 'guest-connected';

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
        activeCard: {
            borderColor: colors.success,
        },
        cardTitle: {
            color: colors.text,
        },
        cardDescription: {
            color: colors.subText,
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

            {!isHosting ? (
                <>
                    {/* Host Session Card */}
                    <View style={[styles.card, dynamicStyles.card]}>
                        <Text style={[styles.cardTitle, dynamicStyles.cardTitle]}>Host Session</Text>
                        <Text style={[styles.cardDescription, dynamicStyles.cardDescription]}>
                            Share your phone screen with a PC. Generate a session code that others can use to connect.
                        </Text>

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
                                connectionStatus === 'connecting' && styles.buttonDisabled,
                            ]}
                            onPress={handleStartHosting}
                            disabled={connectionStatus === 'connecting'}
                        >
                            {connectionStatus === 'connecting' ? (
                                <View style={styles.buttonContent}>
                                    <ActivityIndicator size="small" color="#ffffff" />
                                    <Text style={[styles.buttonText, { marginLeft: 10 }]}>
                                        Connecting...
                                    </Text>
                                </View>
                            ) : (
                                <Text style={styles.buttonText}>Start Hosting</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Info */}
                    <View style={[styles.infoContainer, dynamicStyles.infoContainer]}>
                        <Text style={[styles.infoTitle, { color: colors.primary }]}>How it works:</Text>
                        <Text style={[styles.infoText, dynamicStyles.subText]}>1. Tap "Start Hosting" to generate a session code</Text>
                        <Text style={[styles.infoText, dynamicStyles.subText]}>2. Share the code with someone you trust</Text>
                        <Text style={[styles.infoText, dynamicStyles.subText]}>3. Press "Share Screen" when they connect</Text>
                        <Text style={[styles.infoText, dynamicStyles.subText]}>4. You can navigate to other tabs while session is active</Text>
                    </View>
                </>
            ) : (
                <>
                    {/* Session Active Card */}
                    <View style={[styles.card, dynamicStyles.card, dynamicStyles.activeCard]}>
                        <View style={[styles.statusBadge, { backgroundColor: colors.success + '20' }]}>
                            <View style={[
                                styles.statusDot,
                                { backgroundColor: connectionStatus === 'guest-connected' ? '#22c55e' : colors.success }
                            ]} />
                            <Text style={[styles.statusBadgeText, { color: colors.success }]}>
                                {connectionStatus === 'guest-connected' ? 'Guest Connected' : 'Session Active'}
                            </Text>
                        </View>

                        <Text style={[styles.sessionLabel, dynamicStyles.subText]}>Your Session Code</Text>
                        <Text style={[styles.sessionCode, dynamicStyles.text]}>{formatCode(sessionCode)}</Text>
                        <Text style={[styles.sessionHint, dynamicStyles.subText]}>
                            {connectionStatus === 'guest-connected'
                                ? 'Press "Share Screen" to start sharing'
                                : 'Share this code with the person who will connect'}
                        </Text>

                        {/* Action Buttons */}
                        <View style={styles.actionButtons}>
                            <TouchableOpacity
                                style={[styles.actionButton, styles.refreshButton, { borderColor: '#f59e0b' }]}
                                onPress={handleRefreshCode}
                            >
                                <Text style={styles.actionButtonIcon}>🔄</Text>
                                <Text style={[styles.actionButtonText, { color: colors.text }]}>New Code</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.actionButton, { backgroundColor: colors.border }]}
                                onPress={handleCopyCode}
                            >
                                <Text style={styles.actionButtonIcon}>📋</Text>
                                <Text style={[styles.actionButtonText, { color: colors.text }]}>Copy</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.actionButton, { backgroundColor: colors.primary }]}
                                onPress={handleShareCode}
                            >
                                <Text style={styles.actionButtonIcon}>📤</Text>
                                <Text style={styles.actionButtonText}>Share</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Share Screen Button - Only shown when guest is connected */}
                    {connectionStatus === 'guest-connected' && (
                        <TouchableOpacity
                            style={[styles.button, styles.shareScreenButton]}
                            onPress={handleShareScreen}
                        >
                            <Text style={styles.shareScreenIcon}>📺</Text>
                            <Text style={styles.shareScreenText}>
                                {isScreenSharing ? 'Return to Screen Share' : 'Share Screen'}
                            </Text>
                        </TouchableOpacity>
                    )}

                    {/* Stop Button */}
                    <TouchableOpacity
                        style={[styles.button, styles.stopButton, { borderColor: colors.error, backgroundColor: colors.error + '20' }]}
                        onPress={handleStopHosting}
                    >
                        <Text style={[styles.stopButtonText, { color: colors.error }]}>End Session</Text>
                    </TouchableOpacity>

                    {/* Status */}
                    <View style={styles.waitingContainer}>
                        {connectionStatus === 'session-active' && (
                            <ActivityIndicator size="small" color={colors.primary} style={{ marginBottom: 10 }} />
                        )}
                        <Text style={[styles.waitingText, dynamicStyles.subText]}>{getStatusText()}</Text>
                        {connectionStatus === 'session-active' && (
                            <Text style={[styles.waitingHint, dynamicStyles.subText]}>
                                The other person should enter this code in "Join Session"
                            </Text>
                        )}
                        {connectionStatus === 'guest-connected' && !isScreenSharing && (
                            <Text style={[styles.waitingHint, dynamicStyles.subText]}>
                                Tap "Share Screen" above to start sharing your screen
                            </Text>
                        )}
                    </View>
                </>
            )}
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
    card: {
        backgroundColor: '#16161e',
        borderRadius: 16,
        padding: 24,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#2a2a3a',
    },
    activeCard: {
        borderColor: '#10b981',
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
        opacity: 0.7,
    },
    buttonContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    shareScreenButton: {
        backgroundColor: '#22c55e',
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 12,
    },
    shareScreenIcon: {
        fontSize: 20,
        marginRight: 10,
    },
    shareScreenText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
    },
    stopButton: {
        backgroundColor: '#ef444420',
        borderWidth: 1,
        borderColor: '#ef4444',
        marginBottom: 20,
    },
    buttonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
    },
    stopButtonText: {
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
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#10b98120',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        alignSelf: 'flex-start',
        marginBottom: 24,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#10b981',
        marginRight: 8,
    },
    statusBadgeText: {
        color: '#10b981',
        fontWeight: '600',
        fontSize: 14,
    },
    sessionLabel: {
        fontSize: 14,
        color: '#888',
        marginBottom: 8,
        textAlign: 'center',
    },
    sessionCode: {
        fontSize: 42,
        fontWeight: 'bold',
        color: '#ffffff',
        textAlign: 'center',
        letterSpacing: 4,
        marginBottom: 8,
    },
    sessionHint: {
        fontSize: 13,
        color: '#666',
        textAlign: 'center',
        marginBottom: 24,
    },
    actionButtons: {
        flexDirection: 'row',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: 10,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 10,
        minWidth: 85,
        justifyContent: 'center',
    },
    copyButton: {
        backgroundColor: '#2a2a3a',
    },
    refreshButton: {
        backgroundColor: '#f59e0b30',
        borderWidth: 1,
        borderColor: '#f59e0b',
    },
    shareCodeButton: {
        backgroundColor: '#8b5cf6',
    },
    actionButtonIcon: {
        fontSize: 18,
        marginRight: 8,
    },
    actionButtonText: {
        color: '#ffffff',
        fontWeight: '600',
        fontSize: 14,
    },
    waitingContainer: {
        alignItems: 'center',
        paddingVertical: 30,
    },
    waitingText: {
        fontSize: 16,
        color: '#888',
        marginBottom: 8,
    },
    waitingHint: {
        fontSize: 13,
        color: '#666',
        textAlign: 'center',
    },
});

export default HostSessionScreen;
