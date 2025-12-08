// Join Session Screen - Connect to a remote session with code
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
} from 'react-native';
import { SettingsIcon } from '../components/Icons';
import { socketService } from '../services/SocketService';

interface JoinSessionScreenProps {
    navigation: any;
}

type JoinStatus = 'idle' | 'connecting' | 'joining' | 'error';

const JoinSessionScreen: React.FC<JoinSessionScreenProps> = ({ navigation }) => {
    const [sessionCode, setSessionCode] = useState('');
    const [status, setStatus] = useState<JoinStatus>('idle');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Set up socket event listeners
        socketService.onSessionJoined((sessionId) => {
            console.log('📱 Session joined successfully:', sessionId);
            setStatus('idle');
            setError(null);

            // Navigate to remote screen to view the host's screen
            navigation.navigate('Remote', {
                sessionId: sessionId,
                role: 'viewer',
            });
        });

        socketService.onSessionError((errorMsg) => {
            console.error('❌ Session error:', errorMsg);
            setError(errorMsg);
            setStatus('error');
        });

        socketService.onHostDisconnected(() => {
            Alert.alert('Host Disconnected', 'The host has ended the session.');
            setStatus('idle');
        });

        // Connect to server on mount if not connected
        const connectIfNeeded = async () => {
            if (!socketService.isConnected()) {
                try {
                    await socketService.connect();
                } catch (err) {
                    console.log('📱 Socket connection will happen on join');
                }
            }
        };
        connectIfNeeded();

        return () => {
            // Cleanup is handled by the RemoteScreen
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
            // Connect to server if not connected
            if (!socketService.isConnected()) {
                await socketService.connect();
            }

            setStatus('joining');

            // Join the session
            socketService.joinSession(sessionCode);

            // Set a timeout for if no response
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

    const getButtonText = () => {
        switch (status) {
            case 'connecting':
                return 'Connecting...';
            case 'joining':
                return 'Joining...';
            default:
                return 'Join Session';
        }
    };

    const isButtonDisabled = sessionCode.length !== 8 || status === 'connecting' || status === 'joining';

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

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.content}
            >
                {/* Join Session Card */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Join Remote Session</Text>
                    <Text style={styles.cardDescription}>
                        Enter the 8-character session code from the host to connect and view their screen
                    </Text>

                    <View style={styles.codeInputContainer}>
                        <Text style={styles.codeLabel}>SESSION CODE</Text>
                        <TextInput
                            style={[
                                styles.codeInput,
                                error && styles.codeInputError,
                            ]}
                            placeholder="XXXX-XXXX"
                            placeholderTextColor="#444"
                            value={formatDisplayCode(sessionCode)}
                            onChangeText={handleCodeChange}
                            maxLength={9} // 8 chars + hyphen
                            autoCapitalize="characters"
                            autoCorrect={false}
                            keyboardType="default"
                            editable={status !== 'connecting' && status !== 'joining'}
                        />
                        <Text style={styles.codeHint}>
                            {sessionCode.length}/8 characters
                        </Text>
                    </View>

                    {error && (
                        <View style={styles.errorContainer}>
                            <Text style={styles.errorText}>⚠️ {error}</Text>
                        </View>
                    )}

                    <TouchableOpacity
                        style={[
                            styles.button,
                            styles.primaryButton,
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
                <View style={styles.infoContainer}>
                    <Text style={styles.infoTitle}>How to connect:</Text>
                    <Text style={styles.infoText}>1. Ask the host for their 8-character session code</Text>
                    <Text style={styles.infoText}>2. Enter the code above</Text>
                    <Text style={styles.infoText}>3. Tap "Join Session" to view and control their screen</Text>
                </View>
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
