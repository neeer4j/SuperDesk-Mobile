// Join Session Screen - Connect to a remote session with code

import { Logger } from '../utils/Logger';
// Join Session Screen - Connect to a remote session with code
// Redesigned to use SessionManager for persistent sessions across tabs
import React, { useState, useEffect } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    Alert,
    Keyboard,
    View,
    Text,
    TextInput,
    StyleSheet,
    Image,
} from 'react-native';
import { layout, typography } from '../theme/designSystem';
import { ScreenContainer, Card, Button } from '../components/ui';

import { sessionManager, SessionState } from '../services/SessionManager';
import { webRTCService } from '../services/WebRTCService';
import { socketService } from '../services/SocketService';
import { useTheme } from '../context/ThemeContext';

interface JoinSessionScreenProps {
    navigation: any;
}

type JoinStatus = 'idle' | 'connecting' | 'joining' | 'connected' | 'error';

const JoinSessionScreen: React.FC<JoinSessionScreenProps> = ({ navigation }) => {
    // We stick to the designSystem values primarily
    const { theme, colors } = useTheme();
    const [sessionCode, setSessionCode] = useState('');
    const [status, setStatus] = useState<JoinStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const [hostConnected, setHostConnected] = useState(false);

    useEffect(() => {
        const state = sessionManager.getState();
        const isSocketConnected = socketService.isConnected();

        if (state.isActive && state.role === 'guest' && isSocketConnected) {
            setSessionCode(state.sessionId || '');
            setStatus('connected');
            setHostConnected(true);
        } else if (state.isActive && state.role === 'guest' && !isSocketConnected) {
            Logger.debug('📱 Clearing stale session state - socket disconnected');
            sessionManager.endSession();
        }

        const unsubscribe = sessionManager.subscribe((newState: SessionState, prevState: SessionState) => {
            if (newState.role === 'guest') {
                if (newState.isActive) {
                    setStatus('connected');
                    setSessionCode(newState.sessionId || '');
                    setHostConnected(true);
                }
            } else if (newState.role === null && prevState.role === 'guest') {
                setStatus('idle');
                setSessionCode('');
                setHostConnected(false);
            }
        });

        const handleHostDisconnected = () => {
            Alert.alert('Host Disconnected', 'The host has ended the session.');
            setStatus('idle');
            setHostConnected(false);
        };
        sessionManager.on('hostDisconnected', handleHostDisconnected);

        const handleSessionEnded = () => {
            setStatus('idle');
            setHostConnected(false);
        };
        sessionManager.on('sessionEnded', handleSessionEnded);

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
        };
    }, [navigation]);

    const handleCodeChange = (text: string) => {
        const cleaned = text.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        setSessionCode(cleaned);
        if (error) {
            setError(null);
            setStatus('idle');
        }
    };

    const formatDisplayCode = (code: string) => {
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
            await sessionManager.joinSession(sessionCode);
            Logger.debug('✅ Joined session successfully');
            setStatus('connected');

            try {
                Logger.debug('📱 Initializing WebRTC listener...');
                await webRTCService.initialize('viewer', sessionCode);
            } catch (err) {
                console.error('❌ Failed to init WebRTC:', err);
            }

            setSessionCode('');
            Keyboard.dismiss();

            setTimeout(() => {
                if (status === 'joining') {
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
            case 'connecting': return 'Connecting...';
            case 'joining': return 'Joining...';
            default: return 'Join Session';
        }
    };

    const isButtonDisabled = sessionCode.length !== 8 || status === 'connecting' || status === 'joining' || status === 'connected';

    return (
        <ScreenContainer withScroll>


            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
            >
                {status !== 'connected' ? (
                    <>
                        <Card style={styles.mainCard}>
                            <Text style={[styles.cardTitle, { color: colors.text }]}>Join Remote Session</Text>
                            <Text style={[styles.cardSubtitle, { color: colors.subText }]}>
                                Enter the 8-character code to connect to a host.
                            </Text>

                            <View style={styles.inputContainer}>
                                <Text style={[styles.inputLabel, { color: colors.primary }]}>SESSION CODE</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                                    placeholder="XXXX-XXXX"
                                    placeholderTextColor={colors.subText}
                                    value={formatDisplayCode(sessionCode)}
                                    onChangeText={handleCodeChange}
                                    maxLength={9}
                                    autoCapitalize="characters"
                                    autoCorrect={false}
                                />
                                <Text style={[styles.charCount, { color: colors.subText }]}>{sessionCode.length}/8</Text>
                            </View>

                            {error && (
                                <View style={[styles.errorContainer, { backgroundColor: colors.error + '15' }]}>
                                    <Text style={[styles.errorText, { color: colors.error }]}>⚠️ {error}</Text>
                                </View>
                            )}

                            <Button
                                title={getButtonText()}
                                onPress={handleJoinSession}
                                loading={status === 'connecting' || status === 'joining'}
                                disabled={isButtonDisabled}
                                style={styles.joinButton}
                            />
                        </Card>

                        <View style={styles.helpSection}>
                            <Text style={[styles.helpTitle, { color: colors.subText }]}>HOW TO CONNECT</Text>
                            <Text style={[styles.helpText, { color: colors.subText }]}>1. Ask the host for their 8-character code</Text>
                            <Text style={[styles.helpText, { color: colors.subText }]}>2. Enter the code in the box above</Text>
                            <Text style={[styles.helpText, { color: colors.subText }]}>3. Tap "Join Session" to start viewing</Text>
                        </View>
                    </>
                ) : (
                    <>
                        {/* Connected State */}
                        <Card style={{ ...styles.connectedCard, borderColor: colors.success }} variant="elevated">
                            <View style={[styles.connectedHeader, { backgroundColor: colors.success + '15' }]}>
                                <View style={[styles.connectedIndicator, { backgroundColor: colors.success }]} />
                                <Text style={[styles.connectedTitle, { color: colors.success }]}>Connected to Host</Text>
                            </View>

                            <Text style={[styles.connectedCode, { color: colors.text }]}>{formatDisplayCode(sessionCode)}</Text>
                            <Text style={[styles.connectedHint, { color: colors.subText }]}>
                                You are connected! Ready to view remote screen.
                            </Text>

                            <Button
                                title="View Remote Screen"
                                variant="primary"
                                icon={<Text style={{ fontSize: 18, marginRight: 8, color: '#fff' }}>📺</Text>}
                                onPress={handleViewRemote}
                                style={styles.viewButton}
                            />
                        </Card>

                        <Button
                            title="Disconnect"
                            variant="danger"
                            onPress={handleDisconnect}
                            style={styles.disconnectButton}
                        />
                    </>
                )}
            </KeyboardAvoidingView>
        </ScreenContainer>
    );
};

const styles = StyleSheet.create({

    mainCard: {
        marginBottom: layout.spacing.lg,
    },
    cardTitle: {
        fontFamily: typography.fontFamily.semiBold,
        fontSize: typography.size.lg,
        marginBottom: layout.spacing.xs,
    },
    cardSubtitle: {
        fontFamily: typography.fontFamily.regular,
        fontSize: typography.size.sm,
        marginBottom: layout.spacing.xl,
    },
    inputContainer: {
        marginBottom: layout.spacing.lg,
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: 'bold',
        letterSpacing: 1,
        marginBottom: layout.spacing.sm,
    },
    input: {
        borderRadius: layout.borderRadius.md,
        padding: layout.spacing.md,
        fontFamily: typography.fontFamily.bold,
        fontSize: 24,
        textAlign: 'center',
        letterSpacing: 4,
    },
    charCount: {
        textAlign: 'right',
        fontSize: 12,
        marginTop: layout.spacing.xs,
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
    joinButton: {
        marginTop: layout.spacing.sm,
    },
    helpSection: {
        padding: layout.spacing.md,
    },
    helpTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: layout.spacing.md,
    },
    helpText: {
        fontSize: 14,
        marginBottom: layout.spacing.sm,
    },

    // Connected Styles
    connectedCard: {
        alignItems: 'center',
        paddingVertical: layout.spacing.xl,
        marginBottom: layout.spacing.lg,
    },
    connectedHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: layout.spacing.lg,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    connectedIndicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 8,
    },
    connectedTitle: {
        fontWeight: 'bold',
        fontSize: 14,
    },
    connectedCode: {
        fontSize: 32,
        fontWeight: 'bold',
        letterSpacing: 3,
        marginBottom: layout.spacing.md,
    },
    connectedHint: {
        textAlign: 'center',
        marginBottom: layout.spacing.xl,
    },
    viewButton: {
        width: '100%',
    },
    disconnectButton: {
        width: '100%',
    }
});

export default JoinSessionScreen;
