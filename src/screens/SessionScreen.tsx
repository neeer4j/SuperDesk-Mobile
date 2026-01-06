// Session Screen - Host mode (share phone screen to PC via WebRTC)
// Redesigned to integrate with SessionManager - going back doesn't end session
import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    Alert,
    Share,
    Platform,
} from 'react-native';
import { socketService } from '../services/SocketService';
import { webRTCService } from '../services/WebRTCService';
import { remoteControlService } from '../services/RemoteControlService';
import { sessionManager } from '../services/SessionManager';
import { ScreenContainer, Card, Button } from '../components/ui';
import { layout, typography } from '../theme/designSystem';
import { useTheme } from '../context/ThemeContext';

interface SessionScreenProps {
    route: {
        params: {
            role: 'host';
            sessionId: string;
            guestId: string;
        };
    };
    navigation: any;
}

type SessionStatus = 'initializing' | 'connecting' | 'connected' | 'streaming' | 'error';

const connectionMeta = {
    new: { label: 'Connecting', color: '#f59e0b' },
    connecting: { label: 'Connecting', color: '#f59e0b' },
    connected: { label: 'Connected', color: '#22c55e' },
    streaming: { label: 'Streaming', color: '#22c55e' },
    disconnected: { label: 'Disconnected', color: '#ef4444' },
    failed: { label: 'Failed', color: '#ef4444' },
} as const;

const DRAG_THRESHOLD = 0.02;

const SessionScreen: React.FC<SessionScreenProps> = ({ route, navigation }) => {
    const { theme, colors } = useTheme();
    const { sessionId, guestId } = route.params;

    const [status, setStatus] = useState<SessionStatus>('initializing');
    const [isCapturing, setIsCapturing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [connectionState, setConnectionState] = useState<string>('new');
    const [accessibilityEnabled, setAccessibilityEnabled] = useState(false);
    const [micEnabled, setMicEnabled] = useState(false); // Mic toggle state (off by default)

    const cleanupRef = useRef(false);
    const dragStateRef = useRef<{ startX: number; startY: number; startTime: number } | null>(null);

    useEffect(() => {
        checkAccessibilityService();
        initializeWebRTC();

        // Handle session end from external source (e.g., host tab)
        const handleSessionEnded = () => {
            if (!cleanupRef.current) {
                Alert.alert('Session Ended', 'The session has been ended.', [
                    { text: 'OK', onPress: () => navigation.goBack() }
                ]);
            }
        };
        sessionManager.on('sessionEnded', handleSessionEnded);


        // socketService mouse events... (same logic as before)
        // [Existing socket logic truncated for brevity as it is functional and not UI]
        // Keeping it intact in actual implementation, just wrapping in (...) for this visual update
        // RE-INSERTING EXACT LOGIC BELOW



        // ... (socket event listeners same as original)
        socketService.onMouseEvent(async (data) => {
            // ... existing logic ...
            try {
                const accessibilityOk = await remoteControlService.isServiceEnabled();
                if (!accessibilityOk) return;

                if (data.type === 'down') {
                    dragStateRef.current = { startX: data.x, startY: data.y, startTime: Date.now() };
                    return;
                }
                if (data.type === 'move' && dragStateRef.current) return;

                if (data.type === 'up' && dragStateRef.current) {
                    const deltaX = data.x - dragStateRef.current.startX;
                    const deltaY = data.y - dragStateRef.current.startY;
                    const distCheck = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                    const elapsed = Date.now() - dragStateRef.current.startTime;

                    if (distCheck > DRAG_THRESHOLD) {
                        await remoteControlService.handleRemoteInputEvent({
                            type: 'mouse', action: 'swipe',
                            data: { startX: dragStateRef.current.startX, startY: dragStateRef.current.startY, endX: data.x, endY: data.y, duration: Math.min(elapsed, 500) },
                        });
                    } else {
                        await remoteControlService.handleRemoteInputEvent({
                            type: 'mouse', action: 'click',
                            data: { x: dragStateRef.current.startX, y: dragStateRef.current.startY, button: data.button || 0 },
                        });
                    }
                    dragStateRef.current = null;
                    return;
                }
                if (data.type === 'scroll') {
                    await remoteControlService.handleRemoteInputEvent({
                        type: 'mouse', action: 'wheel',
                        data: { x: data.x || 0.5, y: data.y || 0.5, deltaX: data.deltaX || 0, deltaY: data.deltaY || 0 },
                    });
                    return;
                }
            } catch (e) {
                console.error(e);
            }
        });

        socketService.onKeyboardEvent(async (data) => {
            try {
                await remoteControlService.handleRemoteInputEvent({
                    type: 'keyboard',
                    action: data.type === 'down' ? 'press' : 'special',
                    data: { key: data.key, code: data.code },
                });
            } catch (error) {
                console.error(error);
            }
        });

        return () => {
            cleanupRef.current = true;
            sessionManager.off('sessionEnded', handleSessionEnded);
            stopScreenShareOnly();
            // IMPORTANT: Stop audio stream on cleanup to prevent lingering mic usage
            webRTCService.stopAudioStream();
        };
    }, []);

    const checkAccessibilityService = async () => {
        const enabled = await remoteControlService.isServiceEnabled();
        setAccessibilityEnabled(enabled);
    };

    const initializeWebRTC = async () => {
        try {
            setStatus('initializing');
            await webRTCService.initialize('host', sessionId);
            const currentState = webRTCService.getConnectionState();

            webRTCService.onConnectionStateChange((state) => {
                setConnectionState(state);
                if (state === 'connected') {
                    setStatus('connected');
                    sessionManager.setWebRTCConnected(true);
                    startScreenShare();
                } else if (state === 'failed') {
                    setError('Connection failed. Please try again.');
                    setStatus('error');
                } else if (state === 'disconnected') {
                    sessionManager.setWebRTCConnected(false);
                }
            });

            // Re-adding data channel listener logic from original file...
            webRTCService.onDataChannelMessage(async (message: string) => {
                try {
                    const event = JSON.parse(message);
                    if (event.type === 'mouse' || event.type === 'touch') {
                        const data = event.data || {};
                        const action = event.action;

                        const accessibilityOk = await remoteControlService.isServiceEnabled();
                        if (!accessibilityOk) return;

                        if (action === 'down') {
                            dragStateRef.current = { startX: data.x, startY: data.y, startTime: Date.now() };
                        } else if (action === 'up' && dragStateRef.current) {
                            const deltaX = data.x - dragStateRef.current.startX;
                            const deltaY = data.y - dragStateRef.current.startY;
                            const distCheck = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                            const elapsed = Date.now() - dragStateRef.current.startTime;

                            if (distCheck > DRAG_THRESHOLD) {
                                await remoteControlService.handleRemoteInputEvent({
                                    type: 'mouse', action: 'swipe',
                                    data: { startX: dragStateRef.current.startX, startY: dragStateRef.current.startY, endX: data.x, endY: data.y, duration: Math.min(elapsed, 500) },
                                });
                            } else {
                                await remoteControlService.handleRemoteInputEvent({
                                    type: 'mouse', action: 'click',
                                    data: { x: dragStateRef.current.startX, y: dragStateRef.current.startY, button: data.button || 0 },
                                });
                            }
                            dragStateRef.current = null;
                        } else if ((action === 'wheel' || action === 'scroll')) {
                            await remoteControlService.handleRemoteInputEvent({ type: 'mouse', action: 'wheel', data });
                        }
                    } else if (event.type === 'keyboard') {
                        await remoteControlService.handleRemoteInputEvent(event);
                    }
                } catch (e) {
                    console.warn(e);
                }
            });

            if (currentState === 'connected') {
                setConnectionState('connected');
                sessionManager.setWebRTCConnected(true);
            }

            await requestScreenPermissionAndShare();

        } catch (err: any) {
            setError(err.message || 'Failed to initialize connection');
            setStatus('error');
        }
    };

    const requestScreenPermissionAndShare = async () => {
        if (Platform.OS !== 'android') {
            setError('Screen sharing only supported on Android');
            setStatus('error');
            return;
        }

        try {
            setStatus('connecting');
            const stream = await webRTCService.getDisplayMedia();
            if (!stream) {
                setError('Screen capture permission denied or failed');
                setStatus('error');
                return;
            }

            const tracks = stream.getTracks();
            if (tracks.length === 0) {
                setError('Screen capture returned no video tracks');
                setStatus('error');
                return;
            }

            webRTCService.addStream(stream);
            setIsCapturing(true);
            sessionManager.setScreenSharing(true);

            await new Promise<void>(r => setTimeout(r, 300));
            await webRTCService.createOffer();

        } catch (err: any) {
            setError(err.message || 'Failed to start screen share');
            setStatus('error');
        }
    };

    const startScreenShare = () => {
        setStatus('streaming');
    };

    const stopScreenShareOnly = () => {
        webRTCService.stopScreenShare();
        sessionManager.setScreenSharing(false);
    };

    const endSession = () => {
        // Stop audio stream before closing connection
        webRTCService.stopAudioStream();
        setMicEnabled(false);
        webRTCService.close();
        sessionManager.endSession();
    };

    // Toggle microphone for voice chat
    const toggleMic = async () => {
        try {
            if (!micEnabled) {
                // Enable mic
                await webRTCService.addAudioTrack();
                setMicEnabled(true);
            } else {
                // Disable and stop mic immediately
                webRTCService.stopAudioStream();
                setMicEnabled(false);
            }
        } catch (err) {
            console.error('Mic toggle error:', err);
        }
    };

    const handleGoBack = () => {
        Alert.alert(
            'Stop Screen Share?',
            'This will stop sharing your screen, but the session will remain active.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Stop Sharing',
                    onPress: () => {
                        stopScreenShareOnly();
                        navigation.goBack();
                    },
                },
            ]
        );
    };

    const handleEndSession = () => {
        Alert.alert(
            'End Session',
            'This will completely end the session and disconnect the guest.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'End Session',
                    style: 'destructive',
                    onPress: () => {
                        endSession();
                        navigation.goBack();
                    },
                },
            ]
        );
    };

    const handleShareCode = async () => {
        try {
            await Share.share({
                message: `Join my SuperDesk session: ${sessionId}`,
                title: 'SuperDesk Session Code',
            });
        } catch (err) {
            console.error('Share error:', err);
        }
    };

    const handleRetry = () => {
        setStatus('initializing');
        setError(null);
        initializeWebRTC();
    };

    const formatSessionId = (id: string) => {
        if (id.length >= 8) {
            return id.slice(0, 4) + '-' + id.slice(4, 8);
        }
        return id;
    };

    const getStatusDisplay = () => {
        switch (status) {
            case 'initializing':
                return { text: 'Initializing...', color: colors.warning };
            case 'connecting':
                return { text: 'Starting screen share...', color: colors.warning };
            case 'connected':
                return { text: 'Connected, setting up stream...', color: colors.success };
            case 'streaming':
                return { text: 'Sharing screen to viewer', color: colors.success };
            case 'error':
                return { text: error || 'An error occurred', color: colors.error };
            default:
                return { text: 'Unknown state', color: colors.textSecondary };
        }
    };

    const statusDisplay = getStatusDisplay();

    return (
        <ScreenContainer style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Button
                    title="Back"
                    variant="ghost"
                    onPress={handleGoBack}
                    style={{ paddingHorizontal: 0 }}
                />
                <Text style={[styles.title, { color: colors.textPrimary }]}>Live Session</Text>
                <View style={{ width: 60 }} />
            </View>

            <View style={styles.content}>
                {/* Status Card */}
                <Card padding="lg" style={styles.statusCard}>
                    <View style={styles.statusRow}>
                        <View style={[styles.statusDot, { backgroundColor: statusDisplay.color }]} />
                        <Text style={[styles.statusText, { color: colors.textPrimary }]}>{statusDisplay.text}</Text>
                    </View>

                    {(status === 'initializing' || status === 'connecting') && (
                        <ActivityIndicator
                            size="small"
                            color={colors.primary}
                            style={{ marginTop: 16 }}
                        />
                    )}

                    {status === 'streaming' && (
                        <View style={styles.streamingContainer}>
                            <View style={[styles.pulseRing, { backgroundColor: colors.success }]} />
                            <Text style={styles.streamingEmoji}>📺</Text>
                            <Text style={[styles.streamingText, { color: colors.success }]}>
                                You are sharing your screen
                            </Text>
                        </View>
                    )}

                    {status === 'error' && (
                        <Button title="Retry" onPress={handleRetry} style={{ marginTop: 16 }} />
                    )}
                </Card>

                {/* Session Info */}
                <Card style={styles.infoCard}>
                    <View style={styles.row}>
                        <View>
                            <Text style={[styles.label, { color: colors.textTertiary }]}>SESSION CODE</Text>
                            <Text style={[styles.value, { color: colors.textPrimary }]}>{formatSessionId(sessionId)}</Text>
                        </View>
                        <Button title="Share" size="sm" variant="secondary" onPress={handleShareCode} />
                    </View>

                    <View style={[styles.divider, { backgroundColor: colors.border }]} />

                    <View style={styles.row}>
                        <View>
                            <Text style={[styles.label, { color: colors.textTertiary }]}>GUEST ID</Text>
                            <Text style={[styles.value, { color: colors.textPrimary }]}>{guestId ? guestId.slice(0, 8) + '...' : 'None'}</Text>
                        </View>
                        <View>
                            <Text style={[styles.label, { color: colors.textTertiary }]}>CONNECTION</Text>
                            <View style={styles.chipRow}>
                                <View
                                    style={[
                                        styles.statusDot,
                                        { backgroundColor: connectionMeta[connectionState as keyof typeof connectionMeta]?.color || colors.primary }
                                    ]}
                                />
                                <Text style={[styles.chipText, { color: colors.textPrimary }]}>
                                    {connectionMeta[connectionState as keyof typeof connectionMeta]?.label || connectionState}
                                </Text>
                            </View>
                        </View>
                    </View>
                </Card>

                {/* Accessibility Warning */}
                {!accessibilityEnabled && (
                    <Card style={[styles.warningCard, {
                        borderColor: colors.warning,
                        backgroundColor: colors.warning + '15' // ~10% opacity
                    }]}>
                        <Text style={[styles.warningTitle, { color: colors.warning }]}>⚠️ Access Required</Text>
                        <Text style={[styles.warningText, { color: colors.textSecondary }]}>
                            Accessibility permission is needed for remote control. Follow these steps:
                            {'\n'}1) Tap "Open Settings"
                            {'\n'}2) Find "SuperDesk" in the list
                            {'\n'}3) Enable the toggle, then return to the app
                        </Text>
                        <Button
                            title="Open Settings"
                            variant="secondary"
                            size="sm"
                            onPress={() => remoteControlService.openAccessibilitySettings()}
                            style={{ marginTop: 8 }}
                        />
                    </Card>
                )}
            </View>

            {/* Footer */}
            <View style={styles.footer}>
                <Button
                    title="Stop Sharing"
                    variant="secondary"
                    onPress={handleGoBack}
                    style={{ flex: 1, marginRight: 8 }}
                />
                <Button
                    title={micEnabled ? '🎤 Mic On' : '🔇 Mic Off'}
                    variant={micEnabled ? 'primary' : 'secondary'}
                    onPress={toggleMic}
                    style={{ minWidth: 100 }}
                />
                <Button
                    title="End Session"
                    variant="danger"
                    onPress={handleEndSession}
                    style={{ flex: 1, marginLeft: 8 }}
                />
            </View>
        </ScreenContainer>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: layout.spacing.sm,
    },
    title: {
        fontSize: typography.size.lg,
        fontWeight: '600',
    },
    content: {
        flex: 1,
        paddingVertical: layout.spacing.md,
    },
    statusCard: {
        marginBottom: layout.spacing.md,
        alignItems: 'center',
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 10,
    },
    statusText: {
        fontSize: typography.size.md,
        fontWeight: '500',
    },
    chipRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    chipText: {
        fontSize: typography.size.sm,
        fontWeight: '600',
    },
    streamingContainer: {
        alignItems: 'center',
        marginTop: 20,
    },
    pulseRing: {
        position: 'absolute',
        width: 60,
        height: 60,
        borderRadius: 30,
        opacity: 0.2,
        top: -12,
    },
    streamingEmoji: {
        fontSize: 32,
        marginBottom: 8,
    },
    streamingText: {
        fontWeight: '600',
    },
    infoCard: {
        marginBottom: layout.spacing.md,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    divider: {
        height: 1,
        marginVertical: layout.spacing.md,
    },
    label: {
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 1,
        marginBottom: 4,
    },
    value: {
        fontSize: 16,
        fontWeight: '500',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    warningCard: {
        borderWidth: 1,
    },
    warningTitle: {
        fontWeight: 'bold',
        marginBottom: 4,
    },
    warningText: {
        fontSize: 12,
    },
    footer: {
        flexDirection: 'row',
        marginBottom: layout.spacing.lg,
    },
});

export default SessionScreen;
