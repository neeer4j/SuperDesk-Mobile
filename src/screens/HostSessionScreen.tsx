// Host Session Screen - Share your device screen with session code

import { Logger } from '../utils/Logger';
// Host Session Screen - Share your device screen with session code
// Redesigned to use SessionManager for persistent sessions across tabs
import React, { useState, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Share,
    Alert,
    ActivityIndicator,
    ScrollView,
    Image,
} from 'react-native';
import { sessionManager, SessionState } from '../services/SessionManager';
import { webRTCService } from '../services/WebRTCService';
import { useTheme } from '../context/ThemeContext';
import { ScreenContainer, Card, Button } from '../components/ui';
import { typography, layout } from '../theme/designSystem';
import Clipboard from '@react-native-clipboard/clipboard';

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
            Logger.debug('📱 Guest joined:', data.guestId);
            setGuestId(data.guestId);
            setConnectionStatus('guest-connected');

            // AUTOMATICALLY Initialize WebRTC connection for file transfer
            const initDataConnection = async () => {
                try {
                    Logger.debug('📱 Initializing WebRTC data connection...');
                    await webRTCService.initialize('host', data.sessionId);

                    // Wait a moment for initialization
                    await new Promise<void>(resolve => setTimeout(resolve, 500));

                    // Create offer to establish data channel
                    await webRTCService.createOffer();
                    Logger.debug('📱 Data connection offer sent');
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

    return (
        <ScreenContainer withScroll>
            {!isHosting ? (
                <>
                    {/* Host Session Card */}
                    <Card style={styles.mainCard}>
                        <View style={styles.cardHeader}>
                            <View style={[styles.iconContainer, { backgroundColor: colors.iconBackground }]}>
                                <Text style={styles.iconText}>📡</Text>
                            </View>
                            <View>
                                <Text style={[styles.cardTitle, { color: colors.text }]}>Host Session</Text>
                                <Text style={[styles.cardSubtitle, { color: colors.subText }]}>Share your screen with others</Text>
                            </View>
                        </View>

                        <Text style={[styles.cardDescription, { color: colors.subText }]}>
                            Generate a secure session code to share your screen with PC viewer.
                        </Text>

                        {error && (
                            <View style={[styles.errorContainer, { backgroundColor: colors.error + '15' }]}>
                                <Text style={[styles.errorText, { color: colors.error }]}>⚠️ {error}</Text>
                            </View>
                        )}

                        <Button
                            title={connectionStatus === 'connecting' ? 'Connecting...' : 'Start Hosting'}
                            onPress={handleStartHosting}
                            loading={connectionStatus === 'connecting'}
                            style={styles.hostButton}
                        />
                    </Card>

                    {/* How it works */}
                    <View style={styles.infoSection}>
                        <Text style={[styles.sectionTitle, { color: colors.subText }]}>HOW IT WORKS</Text>

                        <Card variant="outlined" style={styles.infoCard}>
                            <View style={styles.stepRow}>
                                <View style={[styles.stepBadge, { backgroundColor: colors.iconBackground }]}><Text style={[styles.stepText, { color: colors.text }]}>1</Text></View>
                                <Text style={[styles.stepDesc, { color: colors.subText }]}>Tap "Start Hosting" to get a code</Text>
                            </View>
                            <View style={styles.stepRow}>
                                <View style={[styles.stepBadge, { backgroundColor: colors.iconBackground }]}><Text style={[styles.stepText, { color: colors.text }]}>2</Text></View>
                                <Text style={[styles.stepDesc, { color: colors.subText }]}>Share code with the viewer</Text>
                            </View>
                            <View style={styles.stepRow}>
                                <View style={[styles.stepBadge, { backgroundColor: colors.iconBackground }]}><Text style={[styles.stepText, { color: colors.text }]}>3</Text></View>
                                <Text style={[styles.stepDesc, { color: colors.subText }]}>Approve screen share request</Text>
                            </View>
                        </Card>
                    </View>
                </>
            ) : (
                <>
                    {/* Active Session Card */}
                    <Card style={{ ...styles.activeCard, borderColor: colors.primary }}>
                        <View style={[styles.statusHeader, { backgroundColor: colors.iconBackground }]}>
                            <View style={[
                                styles.statusDot,
                                { backgroundColor: connectionStatus === 'guest-connected' ? colors.success : '#f59e0b' }
                            ]} />
                            <Text style={[styles.statusText, { color: colors.text }]}>
                                {connectionStatus === 'guest-connected' ? 'Guest Connected' : 'Waiting for Guest'}
                            </Text>
                        </View>

                        <View style={styles.codeContainer}>
                            <Text style={[styles.codeLabel, { color: colors.primary }]}>SESSION CODE</Text>
                            <Text style={[styles.codeValue, { color: colors.text }]}>{formatCode(sessionCode)}</Text>
                        </View>

                        <View style={styles.actionGrid}>
                            <Button
                                title="Copy"
                                variant="secondary"
                                size="sm"
                                onPress={handleCopyCode}
                                style={styles.actionButton}
                            />
                            <Button
                                title="Share"
                                size="sm"
                                onPress={handleShareCode}
                                style={styles.actionButton}
                            />
                        </View>

                        {connectionStatus === 'guest-connected' && (
                            <Button
                                title={isScreenSharing ? "Return to Stream" : "Share Screen"}
                                variant="primary"
                                onPress={handleShareScreen}
                                style={{ marginTop: 16, backgroundColor: colors.success }}
                            />
                        )}
                    </Card>

                    <Button
                        title="End Session"
                        variant="danger"
                        onPress={handleStopHosting}
                        style={styles.endButton}
                    />

                    <View style={styles.statusFooter}>
                        <Text style={[styles.footerText, { color: colors.subText }]}>{getStatusText()}</Text>
                        {connectionStatus === 'session-active' && (
                            <ActivityIndicator size="small" color={colors.subText} style={{ marginTop: 8 }} />
                        )}
                    </View>
                </>
            )}
        </ScreenContainer>
    );
};

const styles = StyleSheet.create({
    mainCard: {
        marginBottom: layout.spacing.lg,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: layout.spacing.md,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: layout.borderRadius.md,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: layout.spacing.md,
    },
    iconText: {
        fontSize: 24,
    },
    cardTitle: {
        fontFamily: typography.fontFamily.semiBold,
        fontSize: typography.size.lg,
    },
    cardSubtitle: {
        fontFamily: typography.fontFamily.regular,
        fontSize: typography.size.sm,
    },
    cardDescription: {
        fontFamily: typography.fontFamily.regular,
        fontSize: typography.size.md,
        marginBottom: layout.spacing.lg,
        lineHeight: typography.lineHeight.md,
    },
    errorContainer: {
        padding: layout.spacing.md,
        borderRadius: layout.borderRadius.sm,
        marginBottom: layout.spacing.md,
    },
    errorText: {
        fontFamily: typography.fontFamily.medium,
        fontSize: typography.size.sm,
    },
    hostButton: {
        width: '100%',
    },
    infoSection: {
        marginTop: layout.spacing.md,
    },
    sectionTitle: {
        fontFamily: typography.fontFamily.bold,
        fontSize: typography.size.xs,
        letterSpacing: 1,
        marginBottom: layout.spacing.sm,
    },
    infoCard: {
        padding: layout.spacing.md,
    },
    stepRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: layout.spacing.md,
    },
    stepBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: layout.spacing.md,
    },
    stepText: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    stepDesc: {
        fontSize: 14,
    },

    // Active session styles
    activeCard: {
        marginBottom: layout.spacing.lg,
    },
    statusHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: layout.spacing.lg,
        padding: layout.spacing.sm,
        borderRadius: layout.borderRadius.full,
        alignSelf: 'flex-start',
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 8,
        marginLeft: 4,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
        marginRight: 4,
    },
    codeContainer: {
        alignItems: 'center',
        paddingVertical: layout.spacing.xl,
    },
    codeLabel: {
        fontSize: 12,
        letterSpacing: 2,
        fontWeight: 'bold',
        marginBottom: layout.spacing.xs,
    },
    codeValue: {
        fontSize: 40,
        fontFamily: typography.fontFamily.bold,
        letterSpacing: 4,
    },
    actionGrid: {
        flexDirection: 'row',
        gap: layout.spacing.md,
        marginTop: layout.spacing.md,
    },
    actionButton: {
        flex: 1,
    },
    endButton: {
        marginTop: 'auto',
    },
    statusFooter: {
        marginTop: layout.spacing.xl,
        alignItems: 'center',
    },
    footerText: {
        fontSize: 14,
    }
});

export default HostSessionScreen;
