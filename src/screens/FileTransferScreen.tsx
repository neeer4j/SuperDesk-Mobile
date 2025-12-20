// File Transfer Screen - Send and receive files via WebRTC
// Redesigned with new Design System
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    FlatList,
    Alert,
    ActivityIndicator,
    PermissionsAndroid,
    Platform,
    Modal,
} from 'react-native';
import DocumentPicker from 'react-native-document-picker';
import { SettingsIcon, FileTransferIcon } from '../components/Icons';
import { fileTransferService, TransferProgress, FileToSend } from '../services/FileTransferService';
import { sessionManager, SessionState } from '../services/SessionManager';
import { useTheme } from '../context/ThemeContext';
import { ScreenContainer, Card, Button } from '../components/ui';
import { colors, typography, layout } from '../theme/designSystem';

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
            const result = await DocumentPicker.pick({
                type: [DocumentPicker.types.allFiles],
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
        <Card padding="sm" style={styles.transferItem}>
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
                    <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                    <Text style={[
                        styles.statusText,
                        item.status === 'completed' && { color: colors.success },
                        item.status === 'failed' && { color: colors.error }
                    ]}>
                        {getStatusIcon(item.status)}
                    </Text>
                )}
            </View>
        </Card>
    );

    // Determine connection state for UI
    const getConnectionState = () => {
        if (isChannelReady) {
            return { color: colors.success, text: 'Ready to transfer' };
        } else if (sessionState.isActive) {
            return { color: colors.warning, text: 'Session active • View/Share to connect' };
        } else {
            return { color: colors.textTertiary, text: 'No session' };
        }
    };

    const connectionInfo = getConnectionState();

    return (
        <ScreenContainer>
            {/* Header with Settings */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Text style={styles.logo}>File Transfer</Text>
                </View>
                <View style={styles.connectionStatus}>
                    <View style={[styles.connectionDot, { backgroundColor: connectionInfo.color }]} />
                    <Text style={styles.connectionText}>{connectionInfo.text}</Text>
                </View>
                <TouchableOpacity
                    style={styles.settingsButton}
                    onPress={() => navigation.navigate('Settings')}
                >
                    <SettingsIcon size={24} color={colors.textSecondary} />
                </TouchableOpacity>
            </View>

            {/* Active Session Info - Compact */}
            {sessionState.isActive && (
                <Card style={styles.sessionBar} variant="outlined">
                    <View style={styles.sessionInfo}>
                        <Text style={styles.sessionLabel}>
                            {sessionState.role === 'host' ? '📱 Hosting' : '👁️ Joined'}: {formatCode(sessionState.sessionId)}
                        </Text>
                        {sessionState.peerId && (
                            <Text style={styles.peerLabel}>• Peer connected</Text>
                        )}
                    </View>
                    <Button
                        size="sm"
                        variant="danger"
                        title="End"
                        onPress={handleEndSession}
                        style={{ height: 32, paddingVertical: 0 }}
                    />
                </Card>
            )}

            {/* Action Buttons */}
            <View style={styles.actionsContainer}>
                <TouchableOpacity
                    style={[styles.actionButtonContainer, !isChannelReady && { opacity: 0.6 }]}
                    onPress={handleSendFile}
                    disabled={isSending || !isChannelReady}
                >
                    <Card style={styles.actionButtonCard} variant="elevated">
                        <View style={[
                            styles.actionIcon,
                            !isChannelReady && styles.actionIconNotConnected
                        ]}>
                            {isSending ? (
                                <ActivityIndicator size="small" color={colors.primary} />
                            ) : (
                                <Text style={[styles.actionEmoji, !isChannelReady && styles.actionEmojiDimmed]}>📤</Text>
                            )}
                        </View>
                        <Text style={styles.actionText}>
                            {isSending ? 'Sending...' : 'Send File'}
                        </Text>
                    </Card>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.actionButtonContainer}
                    onPress={handleReceiveFiles}
                >
                    <Card style={styles.actionButtonCard} variant="elevated">
                        <View style={styles.actionIcon}>
                            <Text style={styles.actionEmoji}>📥</Text>
                            {/* Notification Badge */}
                            {incomingCount > 0 && (
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>{incomingCount}</Text>
                                </View>
                            )}
                        </View>
                        <Text style={styles.actionText}>Incoming</Text>
                    </Card>
                </TouchableOpacity>
            </View>

            {/* Instructions Section - Only show when not connected */}
            {!sessionState.isActive && (
                <Card style={styles.instructionsContainer} variant="elevated">
                    <Text style={styles.instructionsTitle}>How to Transfer Files</Text>
                    <View style={styles.instructionStep}>
                        <Text style={styles.stepNumber}>1</Text>
                        <Text style={styles.stepText}>Go to <Text style={styles.stepHighlight}>Host</Text> or <Text style={styles.stepHighlight}>Join</Text> tab</Text>
                    </View>
                    <View style={styles.instructionStep}>
                        <Text style={styles.stepNumber}>2</Text>
                        <Text style={styles.stepText}>Start or join a session with another device</Text>
                    </View>
                    <View style={styles.instructionStep}>
                        <Text style={styles.stepNumber}>3</Text>
                        <Text style={styles.stepText}>Start screen sharing to establish connection</Text>
                    </View>
                    <View style={styles.instructionStep}>
                        <Text style={styles.stepNumber}>4</Text>
                        <Text style={styles.stepText}>Return here to send/receive files</Text>
                    </View>
                </Card>
            )}

            {/* Ready indicator */}
            {isChannelReady && (
                <View style={styles.readyBadge}>
                    <Text style={styles.readyBadgeText}>✓ Connection ready • Send or receive files now</Text>
                </View>
            )}

            {/* Transfer History */}
            <View style={styles.historyContainer}>
                <Text style={styles.historyTitle}>Transfer History</Text>

                {transfers.length === 0 ? (
                    <View style={styles.emptyState}>
                        <FileTransferIcon size={48} color={colors.textTertiary} />
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
                        contentContainerStyle={{ paddingBottom: 100 }}
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

                        <Button
                            title="Close"
                            onPress={() => setShowIncomingModal(false)}
                            style={{ marginTop: layout.spacing.md }}
                        />
                    </View>
                </View>
            </Modal>
        </ScreenContainer>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: layout.spacing.md,
        marginBottom: layout.spacing.sm,
    },
    headerLeft: {
        flex: 1,
    },
    logo: {
        fontFamily: typography.fontFamily.bold,
        fontSize: typography.size.xl,
        color: colors.textPrimary,
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
        color: colors.textSecondary,
        fontSize: 11,
        fontFamily: typography.fontFamily.medium,
        flexShrink: 1,
    },
    settingsButton: {
        padding: 8,
    },
    sessionBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
        padding: 12, // override default padding for compact look
    },
    sessionInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    sessionLabel: {
        color: colors.textPrimary,
        fontSize: typography.size.sm,
        fontFamily: typography.fontFamily.medium,
    },
    peerLabel: {
        color: colors.success,
        fontSize: typography.size.xs,
        marginLeft: 8,
        fontFamily: typography.fontFamily.medium,
    },
    actionsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    actionButtonContainer: {
        flex: 1,
        marginHorizontal: 6,
    },
    actionButtonCard: {
        alignItems: 'center',
        padding: 24,
    },
    actionIcon: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.surfaceHighlight,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
        position: 'relative',
    },
    actionIconNotConnected: {
        backgroundColor: colors.background, // dimmer
    },
    actionEmoji: {
        fontSize: 24,
    },
    actionEmojiDimmed: {
        opacity: 0.4,
    },
    actionText: {
        color: colors.textPrimary,
        fontSize: typography.size.md,
        fontFamily: typography.fontFamily.semiBold,
    },
    badge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: colors.error,
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 6,
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: 'bold',
    },
    instructionsContainer: {
        marginBottom: 16,
    },
    instructionsTitle: {
        fontSize: typography.size.md,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.textPrimary,
        marginBottom: 12,
    },
    instructionStep: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    stepNumber: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: colors.primary,
        color: '#FFFFFF',
        fontSize: 12,
        fontFamily: typography.fontFamily.bold,
        textAlign: 'center',
        lineHeight: 24,
        marginRight: 12,
        overflow: 'hidden',
    },
    stepText: {
        flex: 1,
        color: colors.textSecondary,
        fontSize: typography.size.sm,
        fontFamily: typography.fontFamily.regular,
    },
    stepHighlight: {
        color: colors.primary,
        fontFamily: typography.fontFamily.bold,
    },
    readyBadge: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: colors.success + '20',
        borderRadius: 8,
        alignSelf: 'center',
        marginBottom: 16,
    },
    readyBadgeText: {
        color: colors.success,
        fontSize: typography.size.sm,
        fontFamily: typography.fontFamily.medium,
    },
    historyContainer: {
        flex: 1,
        marginTop: 8,
    },
    historyTitle: {
        fontSize: typography.size.lg,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.textPrimary,
        marginBottom: 12,
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        fontSize: typography.size.md,
        color: colors.textPrimary,
        marginTop: 16,
        fontFamily: typography.fontFamily.medium,
    },
    emptySubtext: {
        fontSize: typography.size.sm,
        color: colors.textSecondary,
        marginTop: 8,
        fontFamily: typography.fontFamily.regular,
    },
    transferItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    transferIcon: {
        width: 40,
        height: 40,
        borderRadius: 8,
        backgroundColor: colors.surfaceHighlight,
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
        fontSize: typography.size.sm,
        color: colors.textPrimary,
        fontFamily: typography.fontFamily.medium,
    },
    transferMeta: {
        fontSize: typography.size.xs,
        color: colors.textTertiary,
        marginTop: 4,
        fontFamily: typography.fontFamily.regular,
    },
    progressBar: {
        height: 4,
        backgroundColor: colors.border,
        borderRadius: 2,
        marginTop: 8,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: colors.primary,
        borderRadius: 2,
    },
    transferStatus: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8,
    },
    statusCompleted: {
        backgroundColor: colors.success + '20',
    },
    statusFailed: {
        backgroundColor: colors.error + '20',
    },
    statusTransferring: {
        backgroundColor: colors.primary + '20',
    },
    statusText: {
        fontSize: 12,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: colors.surface,
        borderRadius: layout.borderRadius.lg,
        padding: 20,
        maxHeight: '80%',
        borderWidth: 1,
        borderColor: colors.border,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: typography.size.lg,
        color: colors.textPrimary,
        fontFamily: typography.fontFamily.bold,
    },
    modalClose: {
        fontSize: 24,
        color: colors.textSecondary,
    },
    modalEmpty: {
        padding: 20,
        alignItems: 'center',
    },
    modalEmptyText: {
        fontSize: typography.size.md,
        color: colors.textPrimary,
        marginBottom: 8,
    },
    modalEmptySubtext: {
        fontSize: typography.size.sm,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    modalList: {
        maxHeight: 300,
    },
    modalButton: {
        marginTop: 16,
        backgroundColor: colors.surface,
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    modalButtonText: {
        color: colors.textPrimary,
        fontFamily: typography.fontFamily.medium,
    },
});

export default FileTransferScreen;
