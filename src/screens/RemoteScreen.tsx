// Remote Screen - View and control remote PC
import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    StatusBar,
    Dimensions,
    ActivityIndicator,
    Alert,
    useWindowDimensions,
} from 'react-native';
import {
    GestureHandlerRootView,
    GestureDetector,
    Gesture,
} from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { RTCView, MediaStream } from 'react-native-webrtc';
import { socketService } from '../services/SocketService';
import { webRTCService } from '../services/WebRTCService';
import { inputService } from '../services/InputService';
import { sessionManager } from '../services/SessionManager';
import Joystick from '../components/Joystick';

interface RemoteScreenProps {
    route: {
        params: {
            sessionId: string;
            role: 'viewer';
        };
    };
    navigation: any;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Wrapper functions for input service to avoid Reanimated access errors
const handleTap = (x: number, y: number) => inputService.onTap(x, y);
const handleDoubleTap = (x: number, y: number) => inputService.onDoubleTap(x, y);
const handleLongPress = (x: number, y: number) => inputService.onLongPress(x, y);
const handleTouchStart = (x: number, y: number) => inputService.onTouchStart(x, y);
const handleTouchMove = (x: number, y: number) => inputService.onTouchMove(x, y);
const handleTouchEnd = () => inputService.onTouchEnd();
const handlePinch = (scale: number, cx: number, cy: number) => inputService.onPinch(scale, cx, cy);
const handleJoystickMove = (dx: number, dy: number) => inputService.moveCursorRelative(dx, dy);
const handleJoystickPress = () => inputService.clickAtLastPosition();
const handleTwoFingerScroll = (dx: number, dy: number) => inputService.onTwoFingerPan(dx, dy);

const RemoteScreen: React.FC<RemoteScreenProps> = ({ route, navigation }) => {
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const isLandscape = windowWidth > windowHeight;

    const { sessionId } = route.params;

    const [showJoystick, setShowJoystick] = useState(true);
    const [connectionState, setConnectionState] = useState<string>('connecting');
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [showControls, setShowControls] = useState(true);
    const [isRemoteControlEnabled, setIsRemoteControlEnabled] = useState(false);
    const [isMicOn, setIsMicOn] = useState(false);
    const [streamDimensions, setStreamDimensions] = useState({ width: 1920, height: 1080 });
    const [networkStats, setNetworkStats] = useState<{
        rtt: number | null;
        signalLevel: number; // 0-4 bars
    }>({ rtt: null, signalLevel: 4 });

    // Video display area tracking for accurate coordinate mapping
    const [containerDimensions, setContainerDimensions] = useState({ width: SCREEN_WIDTH, height: SCREEN_HEIGHT });
    const [videoDisplayArea, setVideoDisplayArea] = useState({
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
        offsetX: 0,
        offsetY: 0,
    });

    const cleanupRef = useRef(false);
    const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const resolutionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Calculate video display area when container or stream dimensions change
    useEffect(() => {
        const containerRatio = containerDimensions.width / containerDimensions.height;
        const videoRatio = streamDimensions.width / streamDimensions.height;

        let displayWidth, displayHeight, offsetX, offsetY;

        if (containerRatio > videoRatio) {
            // Container is wider - letterbox on left/right
            displayHeight = containerDimensions.height;
            displayWidth = displayHeight * videoRatio;
            offsetX = (containerDimensions.width - displayWidth) / 2;
            offsetY = 0;
        } else {
            // Container is taller - letterbox on top/bottom
            displayWidth = containerDimensions.width;
            displayHeight = displayWidth / videoRatio;
            offsetX = 0;
            offsetY = (containerDimensions.height - displayHeight) / 2;
        }

        setVideoDisplayArea({
            width: displayWidth,
            height: displayHeight,
            offsetX,
            offsetY,
        });

        // Update input service with actual video dimensions
        inputService.setViewSize(displayWidth, displayHeight);

        console.log('📱 Video display area calculated:', {
            container: containerDimensions,
            video: streamDimensions,
            display: { width: displayWidth, height: displayHeight },
            offset: { x: offsetX, y: offsetY },
        });
    }, [containerDimensions, streamDimensions]);

    // Setup WebRTC and event listeners
    useEffect(() => {
        setupRemoteStreamListener();

        // Only initialize if not already connected
        const currentState = webRTCService.getConnectionState();
        if (currentState !== 'connected' && currentState !== 'connecting') {
            initializeConnection();
        } else {
            console.log('📱 Already connected, checking for existing stream');
            setConnectionState('connected');
            const stream = webRTCService.getRemoteStream();
            if (stream) {
                setRemoteStream(stream);
                checkStreamResolution(stream);
            }
        }

        // Initial setup with screen dimensions
        inputService.setSessionId(sessionId);

        // Auto-hide controls after 5 seconds
        startControlsTimeout();

        // Handle session events
        socketService.onHostStoppedSharing(() => {
            if (!cleanupRef.current) {
                Alert.alert('Host Stopped', 'The host has stopped sharing their screen.', [
                    { text: 'OK', onPress: () => navigation.goBack() },
                ]);
            }
        });

        socketService.onHostDisconnected(() => {
            if (!cleanupRef.current) {
                Alert.alert('Host Disconnected', 'The host has left the session.', [
                    { text: 'OK', onPress: () => navigation.goBack() },
                ]);
            }
        });

        socketService.onSessionEnded(() => {
            if (!cleanupRef.current) {
                Alert.alert('Session Ended', 'The session has been ended.', [
                    { text: 'OK', onPress: () => navigation.goBack() },
                ]);
            }
        });

        socketService.onRemoteControlEnabled(() => {
            setIsRemoteControlEnabled(true);
        });

        socketService.onRemoteControlDisabled(() => {
            setIsRemoteControlEnabled(false);
        });

        // Listen for session manager events too
        sessionManager.on('screenShareStopped', () => {
            if (!cleanupRef.current) {
                Alert.alert('Screen Share Stopped', 'The host has stopped sharing.');
                navigation.goBack();
            }
        });

        return () => {
            cleanupRef.current = true;
            if (controlsTimeoutRef.current) {
                clearTimeout(controlsTimeoutRef.current);
            }
            if (resolutionIntervalRef.current) {
                clearInterval(resolutionIntervalRef.current);
            }
            // WEB RTC KEEP ALIVE - Do not close connection here to support persistence
            // webRTCService.close(); 
        };
    }, []);

    // Monitor stream resolution changes
    useEffect(() => {
        if (remoteStream) {
            // Check immediately
            checkStreamResolution(remoteStream);

            // And check periodically in case it changes or wasn't ready
            resolutionIntervalRef.current = setInterval(() => {
                checkStreamResolution(remoteStream);
            }, 2000);
        }

        return () => {
            if (resolutionIntervalRef.current) {
                clearInterval(resolutionIntervalRef.current);
            }
        };
    }, [remoteStream]);

    // Poll for network quality stats
    useEffect(() => {
        if (!remoteStream) return;

        const pollStats = async () => {
            const stats = await webRTCService.getConnectionStats();

            // Calculate signal level from RTT (0-4 bars)
            let signalLevel = 4; // Excellent by default
            if (stats.rtt !== null) {
                if (stats.rtt > 300) signalLevel = 1;      // Poor: >300ms
                else if (stats.rtt > 150) signalLevel = 2; // Fair: 150-300ms
                else if (stats.rtt > 80) signalLevel = 3;  // Good: 80-150ms
                else signalLevel = 4;                       // Excellent: <80ms
            }

            setNetworkStats({ rtt: stats.rtt, signalLevel });
        };

        // Poll every 2 seconds
        pollStats();
        const intervalId = setInterval(pollStats, 2000);

        return () => clearInterval(intervalId);
    }, [remoteStream]);

    const setupRemoteStreamListener = () => {
        webRTCService.onRemoteStream((stream) => {
            console.log('📱 Got remote stream!');
            setRemoteStream(stream);
            // NOTE: Don't auto-enable remote control here
            // Wait for server to signal when host enables it
            console.log('📱 Stream received, waiting for host to enable control');
        });

        webRTCService.onConnectionStateChange((state) => {
            console.log('📱 Connection state:', state);
            setConnectionState(state);

            if (state === 'failed') {
                if (!cleanupRef.current) {
                    Alert.alert('Connection Failed', 'Failed to connect to the host.', [
                        { text: 'OK', onPress: () => navigation.goBack() },
                    ]);
                }
            } else if (state === 'disconnected') {
                if (!cleanupRef.current) {
                    Alert.alert('Disconnected', 'Lost connection to the host.', [
                        { text: 'OK', onPress: () => navigation.goBack() },
                    ]);
                }
            }
        });

        webRTCService.onDataChannelOpen(() => {
            console.log('📱 Data channel ready for input!');
            // Configure input service when data channel opens
            inputService.setViewSize(SCREEN_WIDTH, SCREEN_HEIGHT);
            inputService.setSessionId(sessionId);

            // AUTO-REQUEST remote control when data channel is ready
            // This tells the host we want to control their desktop
            console.log('📱 Auto-requesting remote control from host...');
            socketService.enableRemoteControl(sessionId);
        });
    };

    const initializeConnection = async () => {
        try {
            // Initialize WebRTC (this will trigger signaling and potentially ontrack)
            await webRTCService.initialize('viewer', sessionId);
        } catch (error) {
            console.error('❌ Connection error:', error);
            Alert.alert('Connection Error', 'Failed to connect to remote session.', [
                { text: 'OK', onPress: () => navigation.goBack() },
            ]);
        }
    };

    // Function to check and update stream resolution
    const checkStreamResolution = (stream: MediaStream) => {
        if (!stream) return;
        const videoTrack = stream.getVideoTracks()[0];
        if (!videoTrack) return;

        // Try to get resolution from settings
        const settings = videoTrack.getSettings ? videoTrack.getSettings() : null;
        // @ts-ignore - react-native-webrtc types might be missing width/height in settings
        const width = settings?.width || (videoTrack as any).width || 0;
        // @ts-ignore
        const height = settings?.height || (videoTrack as any).height || 0;

        if (width > 0 && height > 0) {
            console.log('📱 Detected stream resolution:', width, 'x', height);
            setStreamDimensions(prev => {
                if (prev.width !== width || prev.height !== height) {
                    return { width, height };
                }
                return prev;
            });
        }
    };

    const startControlsTimeout = () => {
        if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current);
        }
        controlsTimeoutRef.current = setTimeout(() => {
            setShowControls(false);
        }, 5000);
    };

    // Helper to convert screen coordinates to video-relative coordinates
    const getVideoRelativeCoords = (x: number, y: number) => {
        'worklet';
        const videoRelativeX = x - videoDisplayArea.offsetX;
        const videoRelativeY = y - videoDisplayArea.offsetY;

        // Check if touch is within video bounds (ignore letterbox areas)
        if (
            videoRelativeX >= 0 &&
            videoRelativeX <= videoDisplayArea.width &&
            videoRelativeY >= 0 &&
            videoRelativeY <= videoDisplayArea.height
        ) {
            return { x: videoRelativeX, y: videoRelativeY, isValid: true };
        }

        return { x: 0, y: 0, isValid: false };
    };

    // Gesture handlers for remote control - ALWAYS send input when we have a stream
    const tapGesture = Gesture.Tap()
        .onEnd((event) => {
            'worklet';
            if (!remoteStream) return;

            const coords = getVideoRelativeCoords(event.x, event.y);
            if (coords.isValid) {
                runOnJS(handleTap)(coords.x, coords.y);
            }
        });

    const doubleTapGesture = Gesture.Tap()
        .numberOfTaps(2)
        .onEnd((event) => {
            'worklet';
            if (!remoteStream) return;

            const coords = getVideoRelativeCoords(event.x, event.y);
            if (coords.isValid) {
                runOnJS(handleDoubleTap)(coords.x, coords.y);
            }
        });

    const longPressGesture = Gesture.LongPress()
        .minDuration(500)
        .onEnd((event) => {
            'worklet';
            if (!remoteStream) return;

            const coords = getVideoRelativeCoords(event.x, event.y);
            if (coords.isValid) {
                runOnJS(handleLongPress)(coords.x, coords.y);
            }
        });

    const panGesture = Gesture.Pan()
        .maxPointers(1)
        .onStart((event) => {
            'worklet';
            if (!remoteStream) return;

            const coords = getVideoRelativeCoords(event.x, event.y);
            if (coords.isValid) {
                runOnJS(handleTouchStart)(coords.x, coords.y);
            }
        })
        .onUpdate((event) => {
            'worklet';
            if (!remoteStream) return;

            const coords = getVideoRelativeCoords(event.x, event.y);
            if (coords.isValid) {
                runOnJS(handleTouchMove)(coords.x, coords.y);
            }
        })
        .onEnd(() => {
            'worklet';
            if (remoteStream) {
                runOnJS(handleTouchEnd)();
            }
        });

    const scrollGesture = Gesture.Pan()
        .minPointers(2)
        .onUpdate((event) => {
            'worklet';
            if (!remoteStream) return;
            // Use translationX/Y deltas if changeX/Y unavailable, but Reanimated worklets usually see all event props.
            // RNGH v2: event.changeX, event.changeY
            runOnJS(handleTwoFingerScroll)((event as any).changeX, (event as any).changeY);
        });

    const pinchGesture = Gesture.Pinch()
        .onUpdate((event) => {
            'worklet';
            if (!remoteStream) return;

            const coords = getVideoRelativeCoords(event.focalX, event.focalY);
            if (coords.isValid) {
                runOnJS(handlePinch)(event.scale, coords.x, coords.y);
            }
        });

    // Combine gestures with priority to double tap
    const composedGesture = Gesture.Race(
        doubleTapGesture,
        Gesture.Simultaneous(
            tapGesture,
            longPressGesture,
            panGesture,
            scrollGesture,
            pinchGesture
        )
    );

    const toggleControls = () => {
        setShowControls(!showControls);
        if (!showControls) {
            startControlsTimeout();
        }
    };

    const handleMicToggle = async () => {
        if (!isMicOn) {
            await webRTCService.addAudioTrack();
            setIsMicOn(true);
            hapticService.selection();
        } else {
            webRTCService.toggleAudio(false);
            setIsMicOn(false);
            hapticService.selection();
        }
    };

    // Go back without ending session - just stop viewing
    const handleGoBack = () => {
        // webRTCService.close(); // Don't close connection here
        navigation.goBack();
    };

    // Fully disconnect from the session
    const handleDisconnect = () => {
        Alert.alert(
            'Leave Session',
            'Do you want to stop viewing or completely leave the session?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Stop Viewing',
                    onPress: () => {
                        // webRTCService.close(); // Don't close connection here
                        navigation.goBack();
                    },
                },
                {
                    text: 'Leave Session',
                    style: 'destructive',
                    onPress: () => {
                        sessionManager.endSession();
                        navigation.goBack();
                    },
                },
            ]
        );
    };

    const getConnectionStatusColor = () => {
        switch (connectionState) {
            case 'connected':
                return '#22c55e';
            case 'connecting':
            case 'new':
                return '#f59e0b';
            case 'failed':
            case 'disconnected':
                return '#ef4444';
            default:
                return '#888';
        }
    };

    const getStatusText = () => {
        if (remoteStream) {
            return isRemoteControlEnabled ? 'Connected • Control Enabled' : 'Connected • View Only';
        }
        switch (connectionState) {
            case 'connecting':
            case 'new':
                return 'Connecting...';
            case 'connected':
                return 'Waiting for video...';
            case 'failed':
                return 'Connection Failed';
            case 'disconnected':
                return 'Disconnected';
            default:
                return connectionState;
        }
    };

    return (
        <GestureHandlerRootView style={styles.container}>
            <StatusBar hidden />

            {/* Remote Stream View */}
            {remoteStream ? (
                <GestureDetector gesture={composedGesture}>
                    <View
                        style={styles.streamContainer}
                        onLayout={(event) => {
                            const { width, height } = event.nativeEvent.layout;
                            setContainerDimensions({ width, height });
                        }}
                    >
                        <RTCView
                            streamURL={remoteStream.toURL()}
                            style={styles.stream}
                            objectFit="contain"
                        />
                    </View>
                </GestureDetector>
            ) : (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#8b5cf6" />
                    <Text style={styles.loadingText}>{getStatusText()}</Text>
                    <Text style={styles.sessionCode}>Session: {sessionId}</Text>
                </View>
            )}

            {/* Controls Overlay - shows when showControls is true */}
            {showControls && remoteStream && (
                <View style={styles.controlsOverlay} pointerEvents="box-none">
                    {/* Top Bar */}
                    <View style={styles.topBar}>
                        <View style={styles.sessionInfo}>
                            <View
                                style={[
                                    styles.statusDot,
                                    { backgroundColor: getConnectionStatusColor() },
                                ]}
                            />
                            <Text style={styles.sessionText}>{getStatusText()}</Text>
                        </View>

                        {/* Network Quality Indicator */}
                        <View style={styles.signalContainer}>
                            <TouchableOpacity
                                style={[styles.controlButton, { backgroundColor: showJoystick ? '#8b5cf6' : 'rgba(255,255,255,0.1)', width: 36, height: 36, padding: 0, marginRight: 8 }]}
                                onPress={() => setShowJoystick(!showJoystick)}
                            >
                                <Text style={{ fontSize: 20 }}>🕹️</Text>
                            </TouchableOpacity>

                            <View style={styles.signalBars}>
                                {[1, 2, 3, 4].map((level) => (
                                    <View
                                        key={level}
                                        style={[
                                            styles.signalBar,
                                            { height: 4 + level * 3 },
                                            networkStats.signalLevel >= level
                                                ? { backgroundColor: networkStats.signalLevel <= 2 ? '#f59e0b' : '#22c55e' }
                                                : { backgroundColor: 'rgba(255,255,255,0.3)' }
                                        ]}
                                    />
                                ))}
                            </View>
                            {networkStats.rtt !== null && (
                                <Text style={styles.rttText}>{networkStats.rtt}ms</Text>
                            )}
                        </View>

                        <TouchableOpacity style={styles.closeButton} onPress={handleDisconnect}>
                            <Text style={styles.closeButtonText}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Bottom Bar */}
                    <View style={styles.bottomBar}>
                        <TouchableOpacity
                            style={styles.controlButton}
                            onPress={() => inputService.sendSpecialKey('escape')}
                        >
                            <Text style={styles.controlButtonText}>ESC</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.controlButton}
                            onPress={() => inputService.sendSpecialKey('home')}
                        >
                            <Text style={styles.controlButtonText}>🏠</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.controlButton}
                            onPress={() => inputService.sendSpecialKey('backspace')}
                        >
                            <Text style={styles.controlButtonText}>⌫</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.controlButton, isMicOn && { backgroundColor: 'rgba(239, 68, 68, 0.3)', borderColor: '#ef4444' }]}
                            onPress={handleMicToggle}
                        >
                            <Text style={styles.controlButtonText}>{isMicOn ? '🎤 On' : '🎤 Mic'}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.controlButton}
                            onPress={() => setIsRemoteControlEnabled(true)}
                        >
                            <Text style={styles.controlButtonText}>🖱️ Control</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}



            {/* Joystick Overlay */}
            {remoteStream && showJoystick && (
                <View
                    style={[
                        styles.joystickContainer,
                        isLandscape
                            ? { left: 60, bottom: 60, right: undefined }
                            : { left: '50%', bottom: 120, right: undefined, marginLeft: -75 }
                    ]}
                    pointerEvents="box-none"
                >
                    <Joystick
                        onMove={(dx, dy) => handleJoystickMove(dx, dy)}
                        onPress={() => handleJoystickPress()}
                        color="#8b5cf6"
                    />
                </View>
            )}

            {/* Floating Toggle Button - always visible when stream exists */}
            {remoteStream && (
                <TouchableOpacity
                    style={[
                        styles.floatingControlButton,
                        showControls ? styles.floatingControlButtonActive : null,
                    ]}
                    onPress={() => setShowControls(!showControls)}
                >
                    <Text style={styles.floatingControlText}>{showControls ? '✕' : '☰'}</Text>
                    <Text style={styles.floatingControlLabel}>{showControls ? 'Hide' : 'Menu'}</Text>
                </TouchableOpacity>
            )}
        </GestureHandlerRootView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    streamContainer: {
        flex: 1,
    },
    stream: {
        flex: 1,
        backgroundColor: '#000',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0a0a0f',
    },
    loadingText: {
        color: '#888',
        fontSize: 16,
        marginTop: 20,
    },
    sessionCode: {
        color: '#555',
        fontSize: 14,
        marginTop: 10,
    },
    controlsOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'space-between',
    },
    topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 10,
        paddingTop: 10,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
    },
    sessionInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    statusDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 10,
    },
    sessionText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeButtonText: {
        color: '#fff',
        fontSize: 18,
    },
    bottomBar: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 10,
        paddingBottom: 10,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        gap: 12,
    },
    controlButton: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 8,
        backgroundColor: 'rgba(139, 92, 246, 0.3)',
        borderWidth: 1,
        borderColor: '#8b5cf6',
        minWidth: 60,
        alignItems: 'center',
    },
    controlButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    floatingControlButton: {
        position: 'absolute',
        right: 10,
        top: '45%',
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(139, 92, 246, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    floatingControlButtonActive: {
        backgroundColor: 'rgba(239, 68, 68, 0.9)',
    },
    floatingControlText: {
        fontSize: 20,
    },
    joystickContainer: {
        position: 'absolute',
        bottom: 80,
        right: 80,
        zIndex: 50,
        elevation: 10,
    },
    signalContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 12,
    },
    signalBars: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        height: 16,
        gap: 2,
        marginRight: 6,
    },
    signalBar: {
        width: 3,
        borderRadius: 1,
    },
    rttText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 10,
        minWidth: 40,
        textAlign: 'right',
    },

    floatingControlLabel: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '600',
        marginTop: -2,
    },
});

export default RemoteScreen;
