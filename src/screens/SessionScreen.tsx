// Session Screen - Host mode (share phone screen to PC via WebRTC)
import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    StatusBar,
    ActivityIndicator,
    Alert,
    Share,
    Platform,
} from 'react-native';
import { socketService } from '../services/SocketService';
import { webRTCService } from '../services/WebRTCService';
import { screenCaptureService } from '../services/ScreenCaptureService';
import { remoteControlService } from '../services/RemoteControlService';

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

const SessionScreen: React.FC<SessionScreenProps> = ({ route, navigation }) => {
    const { sessionId, guestId } = route.params;

    const [status, setStatus] = useState<SessionStatus>('initializing');
    const [isCapturing, setIsCapturing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [connectionState, setConnectionState] = useState<string>('new');
    const [accessibilityEnabled, setAccessibilityEnabled] = useState(false);

    const cleanupRef = useRef(false);

    useEffect(() => {
        checkAccessibilityService();
        initializeWebRTC();

        // Handle session end
        socketService.onSessionEnded(() => {
            if (!cleanupRef.current) {
                Alert.alert('Session Ended', 'The session has been ended.');
                handleGoBack(true);
            }
        });

        return () => {
            cleanupRef.current = true;
            cleanup();
        };
    }, []);

    const checkAccessibilityService = async () => {
        const enabled = await remoteControlService.isServiceEnabled();
        setAccessibilityEnabled(enabled);
        if (!enabled) {
            console.log('📱 Accessibility service not enabled - remote control will not work');
        }
    };

    const handleEnableAccessibility = async () => {
        try {
            await remoteControlService.openAccessibilitySettings();
        } catch (e) {
            console.error('Failed to open accessibility settings:', e);
        }
    };

    const initializeWebRTC = async () => {
        try {
            setStatus('initializing');

            // Initialize WebRTC as host
            await webRTCService.initialize('host', sessionId);

            webRTCService.onConnectionStateChange((state) => {
                console.log('📱 WebRTC state:', state);
                setConnectionState(state);

                if (state === 'connected') {
                    setStatus('connected');
                    // Start screen sharing once connected
                    startScreenShare();
                } else if (state === 'failed') {
                    setError('Connection failed. Please try again.');
                    setStatus('error');
                } else if (state === 'disconnected') {
                    if (!cleanupRef.current) {
                        Alert.alert('Disconnected', 'Lost connection to the viewer.');
                    }
                }
            });

            // Listen for incoming input events from the desktop
            webRTCService.onDataChannelMessage((message: string) => {
                try {
                    const event = JSON.parse(message);
                    if (event.type === 'mouse' || event.type === 'keyboard' || event.type === 'touch') {
                        // Handle remote input via accessibility service
                        remoteControlService.handleRemoteInputEvent(event);
                    }
                } catch (e) {
                    console.warn('Failed to parse data channel message:', e);
                }
            });

            // Now that we're initialized, start screen capture and create offer
            await requestScreenPermissionAndShare();

        } catch (err: any) {
            console.error('❌ WebRTC init error:', err);
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

            // Request screen capture permission
            const hasPermission = await screenCaptureService.requestPermission();
            if (!hasPermission) {
                setError('Screen capture permission denied');
                setStatus('error');
                return;
            }

            // Get the display media stream via WebRTC
            const stream = await webRTCService.getDisplayMedia();
            if (!stream) {
                setError('Failed to get screen stream');
                setStatus('error');
                return;
            }

            // Add stream to peer connection
            webRTCService.addStream(stream);
            setIsCapturing(true);

            // Create and send offer to the guest
            await webRTCService.createOffer();
            console.log('📱 Offer created and sent to guest');

        } catch (err: any) {
            console.error('❌ Screen share error:', err);
            setError(err.message || 'Failed to start screen share');
            setStatus('error');
        }
    };

    const startScreenShare = () => {
        setStatus('streaming');
        console.log('📱 Screen sharing started successfully');
    };

    const cleanup = async () => {
        try {
            await screenCaptureService.stopCapture();
        } catch (e) {
            // Ignore
        }
        webRTCService.close();
    };

    const handleGoBack = (silent: boolean = false) => {
        const doGoBack = async () => {
            await cleanup();
            navigation.goBack();
        };

        if (silent) {
            doGoBack();
        } else {
            Alert.alert(
                'End Session',
                'Are you sure you want to stop sharing your screen?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'End Session',
                        style: 'destructive',
                        onPress: () => {
                            socketService.endSession(sessionId);
                            doGoBack();
                        },
                    },
                ]
            );
        }
    };

    const handleShareCode = async () => {
        try {
            await Share.share({
                message: `Join my SuperDesk session: ${sessionId}`,
                title: 'SuperDesk Session Code',
            });
        } catch (err) {
            console.error('❌ Share error:', err);
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
                return { text: 'Initializing...', color: '#f59e0b' };
            case 'connecting':
                return { text: 'Starting screen share...', color: '#f59e0b' };
            case 'connected':
                return { text: 'Connected, setting up stream...', color: '#22c55e' };
            case 'streaming':
                return { text: 'Sharing screen to viewer', color: '#22c55e' };
            case 'error':
                return { text: error || 'An error occurred', color: '#ef4444' };
            default:
                return { text: 'Unknown state', color: '#888' };
        }
    };

    const statusDisplay = getStatusDisplay();

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0a0a0f" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => handleGoBack()}>
                    <Text style={styles.backButtonText}>←</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Hosting Session</Text>
                <View style={styles.placeholder} />
            </View>

            {/* Main Content */}
            <View style={styles.content}>
                {/* Session Code Display */}
                <View style={styles.codeCard}>
                    <Text style={styles.codeLabel}>SESSION CODE</Text>
                    <Text style={styles.codeValue}>{formatSessionId(sessionId)}</Text>
                    <TouchableOpacity style={styles.shareButton} onPress={handleShareCode}>
                        <Text style={styles.shareButtonText}>📤 Share Code</Text>
                    </TouchableOpacity>
                </View>

                {/* Status Card */}
                <View style={styles.statusCard}>
                    <View style={styles.statusRow}>
                        <View style={[styles.statusDot, { backgroundColor: statusDisplay.color }]} />
                        <Text style={styles.statusText}>{statusDisplay.text}</Text>
                    </View>

                    {(status === 'initializing' || status === 'connecting') && (
                        <ActivityIndicator
                            size="small"
                            color="#8b5cf6"
                            style={{ marginTop: 16 }}
                        />
                    )}

                    {status === 'streaming' && (
                        <View style={styles.streamingInfo}>
                            <Text style={styles.streamingEmoji}>📺</Text>
                            <Text style={styles.streamingText}>
                                Your screen is being shared with the connected viewer
                            </Text>
                        </View>
                    )}

                    {status === 'error' && (
                        <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
                            <Text style={styles.retryButtonText}>🔄 Retry</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Connection Info */}
                <View style={styles.infoCard}>
                    <Text style={styles.infoTitle}>Connection Details</Text>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>WebRTC State:</Text>
                        <Text style={styles.infoValue}>{connectionState}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Screen Capture:</Text>
                        <Text style={styles.infoValue}>
                            {isCapturing ? '✅ Active' : '⏳ Pending'}
                        </Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Guest ID:</Text>
                        <Text style={styles.infoValue}>{guestId?.slice(0, 8) || 'N/A'}</Text>
                    </View>
                </View>

                {/* Tips */}
                <View style={styles.tipsCard}>
                    <Text style={styles.tipsTitle}>💡 Tips</Text>
                    <Text style={styles.tipText}>
                        • The viewer can see everything on your screen
                    </Text>
                    <Text style={styles.tipText}>
                        • Tap "End Session" when you're done sharing
                    </Text>
                    <Text style={styles.tipText}>
                        • Keep this app in the foreground for best performance
                    </Text>
                </View>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
                <TouchableOpacity style={styles.stopButton} onPress={() => handleGoBack()}>
                    <Text style={styles.stopButtonText}>End Session</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a0f',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 50,
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#1e1e2e',
        justifyContent: 'center',
        alignItems: 'center',
    },
    backButtonText: {
        color: '#fff',
        fontSize: 24,
    },
    title: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    placeholder: {
        width: 40,
    },
    content: {
        flex: 1,
        padding: 20,
    },
    codeCard: {
        backgroundColor: '#16161e',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#8b5cf6',
        marginBottom: 16,
    },
    codeLabel: {
        color: '#888',
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 1,
        marginBottom: 8,
    },
    codeValue: {
        color: '#fff',
        fontSize: 36,
        fontWeight: 'bold',
        letterSpacing: 4,
        marginBottom: 16,
    },
    shareButton: {
        backgroundColor: '#2a2a3a',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
    },
    shareButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    statusCard: {
        backgroundColor: '#16161e',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 12,
    },
    statusText: {
        color: '#fff',
        fontSize: 16,
        flex: 1,
    },
    streamingInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 16,
        backgroundColor: '#22c55e20',
        padding: 12,
        borderRadius: 8,
    },
    streamingEmoji: {
        fontSize: 24,
        marginRight: 12,
    },
    streamingText: {
        color: '#22c55e',
        fontSize: 14,
        flex: 1,
    },
    retryButton: {
        marginTop: 16,
        backgroundColor: '#8b5cf6',
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    retryButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    infoCard: {
        backgroundColor: '#16161e',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
    },
    infoTitle: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 12,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    infoLabel: {
        color: '#888',
        fontSize: 13,
    },
    infoValue: {
        color: '#fff',
        fontSize: 13,
    },
    tipsCard: {
        backgroundColor: '#16161e',
        borderRadius: 16,
        padding: 20,
    },
    tipsTitle: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 12,
    },
    tipText: {
        color: '#888',
        fontSize: 13,
        marginBottom: 6,
        lineHeight: 18,
    },
    footer: {
        padding: 20,
        paddingBottom: 40,
    },
    stopButton: {
        backgroundColor: '#ef4444',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
    },
    stopButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default SessionScreen;
