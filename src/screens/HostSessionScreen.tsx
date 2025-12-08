// Host Session Screen - Share your device screen with session code
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
} from 'react-native';
import { SettingsIcon } from '../components/Icons';
import { socketService } from '../services/SocketService';
import { webRTCService } from '../services/WebRTCService';

interface HostSessionScreenProps {
    navigation: any;
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'session-active' | 'guest-connected';

const HostSessionScreen: React.FC<HostSessionScreenProps> = ({ navigation }) => {
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
    const [sessionCode, setSessionCode] = useState('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Set up socket event listeners
        socketService.onSessionCreated((data) => {
            console.log('📱 Session created:', data.sessionId);
            setSessionCode(data.sessionId);
            setConnectionStatus('session-active');
            setError(null);
        });

        socketService.onGuestJoined(async (data) => {
            console.log('📱 Guest joined:', data.guestId);
            setConnectionStatus('guest-connected');

            // Navigate to session screen to handle WebRTC
            navigation.navigate('Session', {
                role: 'host',
                sessionId: data.sessionId,
                guestId: data.guestId,
            });
        });

        socketService.onSessionError((errorMsg) => {
            console.error('❌ Session error:', errorMsg);
            setError(errorMsg);
            setConnectionStatus('disconnected');
        });

        socketService.onSessionEnded(() => {
            console.log('📱 Session ended');
            handleStopHosting(true);
        });

        return () => {
            // Cleanup on unmount
            if (connectionStatus !== 'disconnected') {
                socketService.endSession();
            }
        };
    }, []);

    const handleStartHosting = async () => {
        setConnectionStatus('connecting');
        setError(null);

        try {
            // Connect to signaling server if not connected
            if (!socketService.isConnected()) {
                await socketService.connect();
            }

            // Create session with mobile type
            socketService.createSession('mobile');
        } catch (err: any) {
            console.error('❌ Failed to start hosting:', err);
            setError(err.message || 'Failed to connect to server');
            setConnectionStatus('disconnected');
        }
    };

    const handleStopHosting = (silent: boolean = false) => {
        const stopSession = () => {
            if (sessionCode) {
                socketService.endSession(sessionCode);
            }
            setConnectionStatus('disconnected');
            setSessionCode('');
            setError(null);
        };

        if (silent) {
            stopSession();
        } else {
            Alert.alert(
                'Stop Hosting',
                'Are you sure you want to stop the session?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Stop',
                        style: 'destructive',
                        onPress: stopSession,
                    },
                ]
            );
        }
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

        // End current session and create a new one
        setConnectionStatus('connecting');
        socketService.endSession(sessionCode);

        // Create a new session
        socketService.createSession('mobile');
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
            case 'connected':
                return 'Connected, creating session...';
            case 'session-active':
                return 'Waiting for someone to join...';
            case 'guest-connected':
                return 'Guest connected!';
            default:
                return '';
        }
    };

    const isHosting = connectionStatus === 'session-active' || connectionStatus === 'guest-connected';

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0a0a0f" />

            {/* Header with Settings */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Text style={styles.logo}>SuperDesk</Text>
                </View>
                <TouchableOpacity
                    style={styles.settingsButton}
                    onPress={() => navigation.navigate('Settings')}
                >
                    <SettingsIcon size={24} color="#8b5cf6" />
                </TouchableOpacity>
            </View>

            {!isHosting ? (
                <>
                    {/* Host Session Card */}
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Host Session</Text>
                        <Text style={styles.cardDescription}>
                            Share your phone screen with a PC. Generate a session code that others can use to connect.
                        </Text>

                        {error && (
                            <View style={styles.errorContainer}>
                                <Text style={styles.errorText}>⚠️ {error}</Text>
                            </View>
                        )}

                        <TouchableOpacity
                            style={[
                                styles.button,
                                styles.primaryButton,
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
                    <View style={styles.infoContainer}>
                        <Text style={styles.infoTitle}>How it works:</Text>
                        <Text style={styles.infoText}>1. Tap "Start Hosting" to generate a session code</Text>
                        <Text style={styles.infoText}>2. Share the code with someone you trust</Text>
                        <Text style={styles.infoText}>3. They can view and control your screen</Text>
                    </View>
                </>
            ) : (
                <>
                    {/* Session Active Card */}
                    <View style={[styles.card, styles.activeCard]}>
                        <View style={styles.statusBadge}>
                            <View style={styles.statusDot} />
                            <Text style={styles.statusBadgeText}>Session Active</Text>
                        </View>

                        <Text style={styles.sessionLabel}>Your Session Code</Text>
                        <Text style={styles.sessionCode}>{formatCode(sessionCode)}</Text>
                        <Text style={styles.sessionHint}>
                            Share this code with the person who will connect
                        </Text>

                        {/* Action Buttons */}
                        <View style={styles.actionButtons}>
                            <TouchableOpacity
                                style={[styles.actionButton, styles.refreshButton]}
                                onPress={handleRefreshCode}
                            >
                                <Text style={styles.actionButtonIcon}>🔄</Text>
                                <Text style={styles.actionButtonText}>New Code</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.actionButton, styles.copyButton]}
                                onPress={handleCopyCode}
                            >
                                <Text style={styles.actionButtonIcon}>📋</Text>
                                <Text style={styles.actionButtonText}>Copy</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.actionButton, styles.shareButton]}
                                onPress={handleShareCode}
                            >
                                <Text style={styles.actionButtonIcon}>📤</Text>
                                <Text style={styles.actionButtonText}>Share</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Stop Button */}
                    <TouchableOpacity
                        style={[styles.button, styles.stopButton]}
                        onPress={() => handleStopHosting(false)}
                    >
                        <Text style={styles.stopButtonText}>Stop Hosting</Text>
                    </TouchableOpacity>

                    {/* Status */}
                    <View style={styles.waitingContainer}>
                        {connectionStatus === 'session-active' && (
                            <ActivityIndicator size="small" color="#8b5cf6" style={{ marginBottom: 10 }} />
                        )}
                        <Text style={styles.waitingText}>{getStatusText()}</Text>
                        <Text style={styles.waitingHint}>
                            The other person should enter this code in "Join Session"
                        </Text>
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
    shareButton: {
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
