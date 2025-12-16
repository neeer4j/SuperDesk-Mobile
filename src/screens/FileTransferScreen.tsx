// File Transfer Screen - Send and receive files via WebRTC
// Updated: Shows session status, has notification badge for incoming files
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    StatusBar,
    FlatList,
    Alert,
    ActivityIndicator,
    PermissionsAndroid,
    Platform,
    Modal,
} from 'react-native';
import { pick, types } from '@react-native-documents/picker';
import { SettingsIcon, FileTransferIcon } from '../components/Icons';
import { fileTransferService, TransferProgress, FileToSend } from '../services/FileTransferService';
import { sessionManager, SessionState } from '../services/SessionManager';
import { useTheme } from '../context/ThemeContext';

interface FileTransferScreenProps {
    navigation: any;
}

const FileTransferScreen: React.FC<FileTransferScreenProps> = ({ navigation }) => {
    const { theme, colors } = useTheme();
    const [transfers, setTransfers] = useState<TransferProgress[]>([]);
    const [isChannelReady, setIsChannelReady] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [showIncomingModal, setShowIncomingModal] = useState(false);

    // Session info from SessionManager
    const [sessionState, setSessionState] = useState<SessionState>({
        isActive: false,
        role: null,
        sessionId: null,
        peerId: null,
        isScreenSharing: false,
        isWebRTCConnected: false,
    });

    // Count of incoming (receiving) transfers that are pending or in progress
    const [incomingCount, setIncomingCount] = useState(0);

    useEffect(() => {
        // Initialize state from SessionManager
        const state = sessionManager.getState();
        setSessionState(state);

        // Check if file transfer data channel is ready
        setIsChannelReady(fileTransferService.isReady());

        // Subscribe to session state changes
        const unsubscribe = sessionManager.subscribe((newState: SessionState) => {
            setSessionState(newState);
            if (!newState.isActive) {
                setIsChannelReady(false);
                setIncomingCount(0);
                setTransfers([]);
            }
        });

        // Listen for transfer progress updates
        fileTransferService.onProgress((progress) => {
            setTransfers(prevTransfers => {
                const existing = prevTransfers.findIndex(t => t.id === progress.id);
                let updated: TransferProgress[];
                if (existing >= 0) {
                    updated = [...prevTransfers];
                    updated[existing] = progress;
                } else {
                    updated = [progress, ...prevTransfers];
                }

                // Update incoming count
                const incoming = updated.filter(
                    t => t.direction === 'receive' &&
                        (t.status === 'pending' || t.status === 'transferring')
                ).length;
                setIncomingCount(incoming);

                return updated;
            });
        });

        // Listen for received files
        fileTransferService.onFileReceived((filePath, fileName) => {
            Alert.alert('File Received', `${fileName} saved to Downloads`);
        });

        // Listen for errors
        fileTransferService.onError((error, transferId) => {
            Alert.alert('Transfer Error', error);
        });

        // Periodic check for data channel readiness
        const sessionEndListener = () => {
            console.log('📱 Session ended detected in FileTransferScreen');
            setIsChannelReady(false);
            setIncomingCount(0);
            setTransfers([]);
        };
        sessionManager.on('sessionEnded', sessionEndListener);

        const interval = setInterval(() => {
            setIsChannelReady(fileTransferService.isReady());
        }, 2000);

        return () => {
            clearInterval(interval);
            unsubscribe();
            sessionManager.off('sessionEnded', sessionEndListener);
        };
    }, []);

    const requestStoragePermission = async (): Promise<boolean> => {
        if (Platform.OS !== 'android') return true;

        try {
            const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
                {
                    title: 'Storage Permission',
                    message: 'SuperDesk needs storage access to save received files.',
                    buttonNeutral: 'Ask Me Later',
                    buttonNegative: 'Cancel',
                    buttonPositive: 'OK',
                }
            );
            return granted === PermissionsAndroid.RESULTS.GRANTED;
        } catch (err) {
            console.error('Permission error:', err);
            return false;
        }
    };

    const handleSendFile = async () => {
        if (!isChannelReady) {
            if (!sessionState.isActive) {
                Alert.alert(
                    'No Session',
                    'Please go to Host or Join tab to start a session first.',
                    [{ text: 'OK' }]
                );
            } else {
                Alert.alert(
                    'Not Ready',
                    'The data connection is not ready yet. Please make sure you are viewing/sharing the screen to establish the connection.',
                    [{ text: 'OK' }]
                );
            }
            return;
        }

        try {
            // Pick a file
            const result = await pick({
                type: [types.allFiles],
            });

            const file = result[0];
            if (!file) return;

            // Confirm before sending
            Alert.alert(
                'Confirm Send',
                `Do you want to send "${file.name}"?`,
                [
                    {
                        text: 'Cancel',
                        style: 'cancel',
                    },
                    {
                        text: 'Send',
                        onPress: async () => {
                            try {
                                setIsSending(true);

                                const fileToSend: FileToSend = {
                                    uri: file.uri,
                                    name: file.name || 'unknown',
                                    size: file.size || 0,
                                    type: file.type || 'application/octet-stream',
                                };

                                await fileTransferService.sendFile(fileToSend);
                            } catch (err: any) {
                                console.error('Send failed:', err);
                                Alert.alert('Error', err.message || 'Failed to send file');
                            } finally {
                                setIsSending(false);
                            }
                        },
                    },
                ]
            );

        } catch (error: any) {
            if (error?.code !== 'DOCUMENT_PICKER_CANCELED') {
                Alert.alert('Error', error.message || 'Failed to pick file');
            }
        }
        // NOTE: finally block moved inside onPress for sending, or omitted here as picker doesn't set isSending
    };

    const handleReceiveFiles = async () => {
        const hasPermission = await requestStoragePermission();
        if (!hasPermission) {
            Alert.alert('Permission Required', 'Storage permission is needed to save files.');
            return;
        }

        // Show the incoming files modal
        setShowIncomingModal(true);
        // Mark as read
        setIncomingCount(0);
    };

    const handleEndSession = () => {
        Alert.alert(
            'End Session',
            'Are you sure you want to end the session?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'End Session',
                    style: 'destructive',
                    onPress: () => sessionManager.endSession(),
                },
            ]
        );
    };

    const formatSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const formatCode = (code: string | null): string => {
        if (!code) return '';
        if (code.length >= 8) {
            return code.slice(0, 4) + '-' + code.slice(4, 8);
        }
        return code;
    };

    const getStatusIcon = (status: string): string => {
        switch (status) {
            case 'completed': return '✓';
            case 'failed': return '✗';
            case 'cancelled': return '○';
            case 'transferring': return '↻';
            default: return '...';
        }
    };

    // Filter incoming transfers for the modal
    const incomingTransfers = transfers.filter(t => t.direction === 'receive');

    const renderTransferItem = ({ item }: { item: TransferProgress }) => (
        <View style={styles.transferItem}>
            <View style={styles.transferIcon}>
                <Text style={styles.directionIcon}>
                    {item.direction === 'send' ? '📤' : '📥'}
                </Text>
            </View>
            <View style={styles.transferInfo}>
                <Text style={styles.transferName} numberOfLines={1}>
                    {item.name}
                </Text>
                <Text style={styles.transferMeta}>
                    {formatSize(item.size)} • {item.progress}%
                </Text>
                {item.status === 'transferring' && (
                    <View style={styles.progressBar}>
                        <View
                            style={[
                                styles.progressFill,
                                { width: `${item.progress}%` }
                            ]}
                        />
                    </View>
                )}
            </View>
            <View style={[
                styles.transferStatus,
                item.status === 'completed' && styles.statusCompleted,
                item.status === 'failed' && styles.statusFailed,
                item.status === 'transferring' && styles.statusTransferring,
            ]}>
                {item.status === 'transferring' ? (
                    <ActivityIndicator size="small" color="#8b5cf6" />
                ) : (
                    <Text style={styles.statusText}>
                        {getStatusIcon(item.status)}
                    </Text>
                )}
            </View>
        </View>
    );

    // Determine connection state for UI
    const getConnectionState = () => {
        if (isChannelReady) {
            return { color: '#22c55e', text: 'Ready to transfer' };
        } else if (sessionState.isActive) {
            return { color: '#f59e0b', text: 'Session active • View/Share to connect' };
        } else {
            return { color: '#666', text: 'No session' };
        }
    };

    const connectionInfo = getConnectionState();

    // Dynamic styles based on theme
    const dynamicStyles = {
        container: { backgroundColor: colors.background },
        card: { backgroundColor: colors.card, borderColor: colors.cardBorder },
        text: { color: colors.text },
        subText: { color: colors.subText },
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
                    <Text style={[styles.logo, dynamicStyles.text]}>File Transfer</Text>
                </View>
                <View style={styles.connectionStatus}>
                    <View style={[styles.connectionDot, { backgroundColor: connectionInfo.color }]} />
                    <Text style={[styles.connectionText, dynamicStyles.subText]}>{connectionInfo.text}</Text>
                </View>
                <TouchableOpacity
                    style={styles.settingsButton}
                    onPress={() => navigation.navigate('Settings')}
                >
                    <SettingsIcon size={24} color={colors.primary} />
                </TouchableOpacity>
            </View>

            {/* Active Session Info - Compact */}
            {sessionState.isActive && (
                <View style={[styles.sessionBar, dynamicStyles.card, { borderColor: colors.success + '40' }]}>
                    <View style={styles.sessionInfo}>
                        <Text style={[styles.sessionLabel, dynamicStyles.text]}>
                            {sessionState.role === 'host' ? '📱 Hosting' : '👁️ Joined'}: {formatCode(sessionState.sessionId)}
                        </Text>
                        {sessionState.peerId && (
                            <Text style={styles.peerLabel}>• Peer connected</Text>
                        )}
                    </View>
                    <TouchableOpacity style={styles.endButton} onPress={handleEndSession}>
                        <Text style={styles.endButtonText}>End</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionsContainer}>
                <TouchableOpacity
                    style={[
                        styles.actionButton,
                        dynamicStyles.card,
                        !isChannelReady && styles.actionButtonNotConnected,
                        isSending && styles.actionButtonDisabled
                    ]}
                    onPress={handleSendFile}
                    disabled={isSending}
                >
                    <View style={[
                        styles.actionIcon,
                        { backgroundColor: theme === 'dark' ? '#1e1e2e' : colors.iconBackground },
                        !isChannelReady && styles.actionIconNotConnected
                    ]}>
                        {isSending ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                            <Text style={[styles.actionEmoji, !isChannelReady && styles.actionEmojiDimmed]}>📤</Text>
                        )}
                    </View>
                    <Text style={[styles.actionText, dynamicStyles.text, !isChannelReady && dynamicStyles.subText]}>
                        {isSending ? 'Sending...' : 'Send File'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.actionButton, dynamicStyles.card]}
                    onPress={handleReceiveFiles}
                >
                    <View style={[styles.actionIcon, { backgroundColor: theme === 'dark' ? '#1e1e2e' : colors.iconBackground }]}>
                        <Text style={styles.actionEmoji}>📥</Text>
                        {/* Notification Badge */}
                        {incomingCount > 0 && (
                            <View style={[styles.badge, { backgroundColor: colors.error }]}>
                                <Text style={styles.badgeText}>{incomingCount}</Text>
                            </View>
                        )}
                    </View>
                    <Text style={[styles.actionText, dynamicStyles.text]}>Incoming Files</Text>
                </TouchableOpacity>
            </View>

            {/* Instructions Section - Only show when not connected */}
            {!sessionState.isActive && (
                <View style={[styles.instructionsContainer, dynamicStyles.card]}>
                    <Text style={[styles.instructionsTitle, dynamicStyles.text]}>How to Transfer Files</Text>
                    <View style={styles.instructionStep}>
                        <Text style={[styles.stepNumber, { backgroundColor: colors.primary }]}>1</Text>
                        <Text style={[styles.stepText, dynamicStyles.subText]}>Go to <Text style={[styles.stepHighlight, { color: colors.primary }]}>Host</Text> or <Text style={[styles.stepHighlight, { color: colors.primary }]}>Join</Text> tab</Text>
                    </View>
                    <View style={styles.instructionStep}>
                        <Text style={[styles.stepNumber, { backgroundColor: colors.primary }]}>2</Text>
                        <Text style={[styles.stepText, dynamicStyles.subText]}>Start or join a session with another device</Text>
                    </View>
                    <View style={styles.instructionStep}>
                        <Text style={[styles.stepNumber, { backgroundColor: colors.primary }]}>3</Text>
                        <Text style={[styles.stepText, dynamicStyles.subText]}>Start screen sharing to establish connection</Text>
                    </View>
                    <View style={styles.instructionStep}>
                        <Text style={[styles.stepNumber, { backgroundColor: colors.primary }]}>4</Text>
                        <Text style={[styles.stepText, dynamicStyles.subText]}>Return here to send/receive files</Text>
                    </View>
                </View>
            )}

            {/* Ready indicator */}
            {isChannelReady && (
                <View style={[styles.readyBadge, { backgroundColor: colors.success + '20' }]}>
                    <Text style={[styles.readyBadgeText, { color: colors.success }]}>✓ Connection ready • Send or receive files now</Text>
                </View>
            )}

            {/* Transfer History */}
            <View style={[styles.historyContainer, dynamicStyles.card]}>
                <Text style={[styles.historyTitle, dynamicStyles.text]}>Transfer History</Text>

                {transfers.length === 0 ? (
                    <View style={styles.emptyState}>
                        <FileTransferIcon size={48} color="#333" />
                        <Text style={styles.emptyText}>No transfers yet</Text>
                        <Text style={styles.emptySubtext}>
                            Your file transfers will appear here
                        </Text>
                    </View>
                ) : (
                    <FlatList
                        data={transfers}
                        renderItem={renderTransferItem}
                        keyExtractor={(item) => item.id}
                        showsVerticalScrollIndicator={false}
                    />
                )}
            </View>

            {/* Incoming Files Modal */}
            <Modal
                visible={showIncomingModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowIncomingModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>📥 Incoming Files</Text>
                            <TouchableOpacity onPress={() => setShowIncomingModal(false)}>
                                <Text style={styles.modalClose}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        {incomingTransfers.length === 0 ? (
                            <View style={styles.modalEmpty}>
                                <Text style={styles.modalEmptyText}>No incoming files</Text>
                                <Text style={styles.modalEmptySubtext}>
                                    Files sent to you will appear here automatically.
                                    You don't need to accept them - they save directly to Downloads.
                                </Text>
                            </View>
                        ) : (
                            <FlatList
                                data={incomingTransfers}
                                renderItem={renderTransferItem}
                                keyExtractor={(item) => item.id}
                                style={styles.modalList}
                            />
                        )}

                        <TouchableOpacity
                            style={styles.modalButton}
                            onPress={() => setShowIncomingModal(false)}
                        >
                            <Text style={styles.modalButtonText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
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
        marginBottom: 16,
    },
    headerLeft: {
        flex: 1,
    },
    logo: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#ffffff',
    },
    connectionStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 16,
        maxWidth: 150,
    },
    connectionDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
    connectionText: {
        color: '#888',
        fontSize: 11,
        flexShrink: 1,
    },
    settingsButton: {
        padding: 8,
    },
    sessionBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#16161e',
        borderRadius: 10,
        padding: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#22c55e40',
    },
    sessionInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    sessionLabel: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '500',
    },
    peerLabel: {
        color: '#22c55e',
        fontSize: 12,
        marginLeft: 8,
    },
    endButton: {
        backgroundColor: '#ef444420',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#ef4444',
    },
    endButtonText: {
        color: '#ef4444',
        fontSize: 12,
        fontWeight: '600',
    },
    actionsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    actionButton: {
        flex: 1,
        backgroundColor: '#16161e',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        marginHorizontal: 6,
        borderWidth: 1,
        borderColor: '#2a2a3a',
    },
    actionButtonNotConnected: {
        backgroundColor: '#0d0d12',
        borderColor: '#1a1a22',
    },
    actionButtonDisabled: {
        opacity: 0.6,
    },
    actionIcon: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#1e1e2e',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
        position: 'relative',
    },
    actionIconNotConnected: {
        backgroundColor: '#141418',
    },
    actionEmoji: {
        fontSize: 24,
    },
    actionEmojiDimmed: {
        opacity: 0.4,
    },
    actionText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    actionTextDimmed: {
        color: '#555',
    },
    badge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#ef4444',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 6,
    },
    badgeText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: 'bold',
    },
    instructionsContainer: {
        backgroundColor: '#16161e',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#2a2a3a',
    },
    instructionsTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 16,
    },
    instructionStep: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    stepNumber: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#8b5cf6',
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center',
        lineHeight: 24,
        marginRight: 12,
        overflow: 'hidden',
    },
    stepText: {
        flex: 1,
        color: '#888',
        fontSize: 14,
        lineHeight: 20,
    },
    stepHighlight: {
        color: '#8b5cf6',
        fontWeight: '600',
    },
    readyBadge: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: '#22c55e20',
        borderRadius: 8,
        alignSelf: 'center',
        marginBottom: 16,
    },
    readyBadgeText: {
        color: '#22c55e',
        fontSize: 14,
        fontWeight: '600',
    },
    historyContainer: {
        flex: 1,
        backgroundColor: '#16161e',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: '#2a2a3a',
    },
    historyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 16,
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        fontSize: 16,
        color: '#666',
        marginTop: 16,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#444',
        marginTop: 8,
    },
    transferItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#2a2a3a',
    },
    transferIcon: {
        width: 40,
        height: 40,
        borderRadius: 8,
        backgroundColor: '#1e1e2e',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    directionIcon: {
        fontSize: 18,
    },
    transferInfo: {
        flex: 1,
    },
    transferName: {
        fontSize: 14,
        color: '#fff',
        fontWeight: '500',
    },
    transferMeta: {
        fontSize: 12,
        color: '#666',
        marginTop: 4,
    },
    progressBar: {
        height: 4,
        backgroundColor: '#2a2a3a',
        borderRadius: 2,
        marginTop: 8,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#8b5cf6',
        borderRadius: 2,
    },
    transferStatus: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#333',
        alignItems: 'center',
        justifyContent: 'center',
    },
    statusCompleted: {
        backgroundColor: '#22c55e20',
    },
    statusFailed: {
        backgroundColor: '#ef444420',
    },
    statusTransferring: {
        backgroundColor: '#8b5cf620',
    },
    statusText: {
        fontSize: 12,
        color: '#fff',
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#16161e',
        borderRadius: 16,
        padding: 20,
        width: '100%',
        maxHeight: '80%',
        borderWidth: 1,
        borderColor: '#2a2a3a',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#fff',
    },
    modalClose: {
        fontSize: 24,
        color: '#888',
        padding: 4,
    },
    modalEmpty: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    modalEmptyText: {
        fontSize: 16,
        color: '#888',
        marginBottom: 8,
    },
    modalEmptySubtext: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        lineHeight: 20,
    },
    modalList: {
        maxHeight: 300,
    },
    modalButton: {
        backgroundColor: '#8b5cf6',
        borderRadius: 12,
        padding: 14,
        alignItems: 'center',
        marginTop: 20,
    },
    modalButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default FileTransferScreen;
