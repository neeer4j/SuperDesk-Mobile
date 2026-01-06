// File Transfer Screen - Send and receive files via WebRTC

import { Logger } from '../utils/Logger';
// File Transfer Screen - Send and receive files via WebRTC
// Redesigned with new Design System
import React, { useState, useEffect, useRef } from 'react';
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
    Image,
} from 'react-native';
import DocumentPicker from 'react-native-document-picker';

import { fileTransferService, TransferProgress, FileToSend } from '../services/FileTransferService';
import { sessionManager, SessionState } from '../services/SessionManager';
import { useTheme } from '../context/ThemeContext';
import { ScreenContainer, Card, Button } from '../components/ui';
import { typography, layout } from '../theme/designSystem';

interface FileTransferScreenProps {
    navigation: any;
}

const FileTransferScreen: React.FC<FileTransferScreenProps> = ({ navigation }) => {
    const { theme, colors } = useTheme();
    const [transfers, setTransfers] = useState<TransferProgress[]>([]);
    const [isChannelReady, setIsChannelReady] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [showIncomingModal, setShowIncomingModal] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        requestNotificationPermission();

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
            showToast(`Received: ${fileName}`, 'success');
        });

        // Listen for errors
        fileTransferService.onError((error) => {
            showToast(error, 'error');
        });

        // Periodic check for data channel readiness
        const sessionEndListener = () => {
            Logger.debug('📱 Session ended detected in FileTransferScreen');
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

    const requestNotificationPermission = async () => {
        if (Platform.OS !== 'android') return;
        if (!PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS) return;
        try {
            await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS, {
                title: 'Notification Permission',
                message: 'Allow SuperDesk to show file transfer notifications.',
                buttonPositive: 'Allow',
                buttonNegative: 'Deny',
            });
        } catch (err) {
            Logger.debug('Notification permission request failed', err);
        }
    };

    const showToast = (message: string, type: 'success' | 'error') => {
        if (toastTimeoutRef.current) {
            clearTimeout(toastTimeoutRef.current);
        }
        setToast({ message, type });
        toastTimeoutRef.current = setTimeout(() => setToast(null), 2600);
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
            <View style={[styles.transferIcon, { backgroundColor: colors.surfaceHighlight }]}>
                <Text style={styles.directionIcon}>
                    {item.direction === 'send' ? '📤' : '📥'}
                </Text>
            </View>
            <View style={styles.transferInfo}>
                <Text style={[styles.transferName, { color: colors.textPrimary }]} numberOfLines={1}>
                    {item.name}
                </Text>
                <Text style={[styles.transferMeta, { color: colors.textTertiary }]}>
                    {formatSize(item.size)} • {item.progress}%
                </Text>
                {item.status === 'transferring' && (
                    <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                        <View
                            style={[
                                styles.progressFill,
                                { width: `${item.progress}%`, backgroundColor: colors.primary }
                            ]}
                        />
                    </View>
                )}
            </View>
            <View style={[
                styles.transferStatus,
                { backgroundColor: colors.surface },
                item.status === 'completed' && { backgroundColor: colors.success + '20' },
                item.status === 'failed' && { backgroundColor: colors.error + '20' },
                item.status === 'transferring' && { backgroundColor: colors.primary + '20' },
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
            {toast && (
                <View
                    style={[
                        styles.toast,
                        {
                            backgroundColor: toast.type === 'success' ? colors.success + 'E6' : colors.error + 'E6',
                            borderColor: toast.type === 'success' ? colors.success : colors.error,
                        }
                    ]}
                >
                    <Text style={[styles.toastText, { color: colors.background }]}>{toast.message}</Text>
                </View>
            )}


            {/* Session Info Bar - Compact */}
            {sessionState.isActive && (
                <Card style={styles.sessionBar} padding="sm">
                    <View style={styles.sessionInfo}>
                        <Text style={[styles.sessionLabel, { color: colors.textPrimary }]}>
                            {sessionState.role === 'host' ? '📱 Hosting' : '👁️ Joined'}: {formatCode(sessionState.sessionId)}
                        </Text>
                        {sessionState.peerId && (
                            <Text style={[styles.peerLabel, { color: colors.success }]}>• Peer connected</Text>
                        )}
                    </View>
                    <Button
                        title="End"
                        size="sm"
                        variant="ghost"
                        onPress={handleEndSession}
                        style={{ height: 32 }}
                    />
                </Card>
            )}

            {/* Actions */}
            <View style={styles.actionsContainer}>
                <TouchableOpacity
                    style={[styles.actionButtonContainer, !isChannelReady && { opacity: 0.6 }]}
                    onPress={handleSendFile}
                    disabled={isSending || !isChannelReady}
                >
                    <Card style={styles.actionButtonCard}>
                        <View style={[
                            styles.actionIcon,
                            { backgroundColor: isChannelReady ? colors.surfaceHighlight : colors.background }
                        ]}>
                            {isSending ? (
                                <ActivityIndicator size="small" color={colors.primary} />
                            ) : (
                                <Text style={[
                                    styles.actionEmoji,
                                    !isChannelReady && styles.actionEmojiDimmed
                                ]}>📄</Text>
                            )}
                        </View>
                        <Text style={[styles.actionText, { color: colors.textPrimary }]}>
                            {isSending ? 'Sending...' : 'Send File'}
                        </Text>
                    </Card>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.actionButtonContainer}
                    onPress={handleReceiveFiles}
                >
                    <Card style={styles.actionButtonCard}>
                        <View style={[styles.actionIcon, { backgroundColor: colors.surfaceHighlight }]}>
                            <Text style={styles.actionEmoji}>📥</Text>
                            {incomingCount > 0 && (
                                <View style={[styles.badge, { backgroundColor: colors.error }]}>
                                    <Text style={styles.badgeText}>{incomingCount}</Text>
                                </View>
                            )}
                        </View>
                        <Text style={[styles.actionText, { color: colors.textPrimary }]}>Incoming</Text>
                    </Card>
                </TouchableOpacity>
            </View>

            {/* Instructions (only if no active session) */}
            {!sessionState.isActive && (
                <View style={styles.instructionsContainer}>
                    <Text style={[styles.instructionsTitle, { color: colors.textPrimary }]}>How to Transfer Files</Text>
                    <View style={styles.instructionStep}>
                        <Text style={[styles.stepNumber, { backgroundColor: colors.primary, color: '#FFFFFF' }]}>1</Text>
                        <Text style={[styles.stepText, { color: colors.textSecondary }]}>
                            Go to <Text style={[styles.stepHighlight, { color: colors.primary }]}>Host</Text> or <Text style={[styles.stepHighlight, { color: colors.primary }]}>Join</Text> tab
                        </Text>
                    </View>
                    <View style={styles.instructionStep}>
                        <Text style={[styles.stepNumber, { backgroundColor: colors.primary, color: '#FFFFFF' }]}>2</Text>
                        <Text style={[styles.stepText, { color: colors.textSecondary }]}>Start or join a session with another device</Text>
                    </View>
                    <View style={styles.instructionStep}>
                        <Text style={[styles.stepNumber, { backgroundColor: colors.primary, color: '#FFFFFF' }]}>3</Text>
                        <Text style={[styles.stepText, { color: colors.textSecondary }]}>Start screen sharing to establish connection</Text>
                    </View>
                    <View style={styles.instructionStep}>
                        <Text style={[styles.stepNumber, { backgroundColor: colors.primary, color: '#FFFFFF' }]}>4</Text>
                        <Text style={[styles.stepText, { color: colors.textSecondary }]}>Return here to send/receive files</Text>
                    </View>
                </View>
            )}

            {/* Ready indicator */}
            {isChannelReady && (
                <View style={[styles.readyBadge, { backgroundColor: colors.success + '20' }]}>
                    <Text style={[styles.readyBadgeText, { color: colors.success }]}>
                        ✨ Data channel ready
                    </Text>
                </View>
            )}

            {/* History List */}
            <View style={styles.historyContainer}>
                <Text style={[styles.historyTitle, { color: colors.textPrimary }]}>Transfer History</Text>
                {transfers.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={[styles.emptyText, { color: colors.textPrimary }]}>No transfers yet</Text>
                        <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                            Your file transfers will appear here
                        </Text>
                    </View>
                ) : (
                    <FlatList
                        data={transfers}
                        renderItem={renderTransferItem}
                        keyExtractor={item => item.id}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 20 }}
                    />
                )}
            </View>

            {/* Incoming Files Modal */}
            <Modal
                transparent
                visible={showIncomingModal}
                animationType="slide"
                onRequestClose={() => setShowIncomingModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>📥 Incoming Files</Text>
                            <TouchableOpacity onPress={() => setShowIncomingModal(false)}>
                                <Text style={[styles.modalClose, { color: colors.textSecondary }]}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        {incomingTransfers.length === 0 ? (
                            <View style={styles.modalEmpty}>
                                <Text style={[styles.modalEmptyText, { color: colors.textPrimary }]}>No incoming files</Text>
                                <Text style={[styles.modalEmptySubtext, { color: colors.textSecondary }]}>
                                    Files sent to you will appear here automatically.
                                    You don't need to accept them - they save directly to Downloads.
                                </Text>
                            </View>
                        ) : (
                            <FlatList
                                data={incomingTransfers}
                                keyExtractor={item => item.id}
                                style={styles.modalList}
                                renderItem={renderTransferItem}
                            />
                        )}

                        <TouchableOpacity
                            style={[styles.modalButton, { backgroundColor: colors.surface }]}
                            onPress={() => setShowIncomingModal(false)}
                        >
                            <Text style={[styles.modalButtonText, { color: colors.textPrimary }]}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </ScreenContainer>
    );
};

const styles = StyleSheet.create({
    toast: {
        position: 'absolute',
        top: 12,
        left: layout.spacing.md,
        right: layout.spacing.md,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 10,
        borderWidth: 1,
        zIndex: 10,
        elevation: 3,
    },
    toastText: {
        fontSize: typography.size.sm,
        fontWeight: '600',
        textAlign: 'center',
    },

    sessionBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
        padding: 12,
    },
    sessionInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    sessionLabel: {
        fontSize: typography.size.sm,
        fontFamily: typography.fontFamily.medium,
    },
    peerLabel: {
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
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
        position: 'relative',
    },
    actionIconNotConnected: {
    },
    actionEmoji: {
        fontSize: 24,
    },
    actionEmojiDimmed: {
        opacity: 0.4,
    },
    actionText: {
        fontSize: typography.size.md,
        fontFamily: typography.fontFamily.semiBold,
    },
    badge: {
        position: 'absolute',
        top: -4,
        right: -4,
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
        fontSize: typography.size.sm,
        fontFamily: typography.fontFamily.regular,
    },
    stepHighlight: {
        fontFamily: typography.fontFamily.bold,
    },
    readyBadge: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignSelf: 'center',
        marginBottom: 16,
    },
    readyBadgeText: {
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
        marginTop: 16,
        fontFamily: typography.fontFamily.medium,
    },
    emptySubtext: {
        fontSize: typography.size.sm,
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
        fontFamily: typography.fontFamily.medium,
    },
    transferMeta: {
        fontSize: typography.size.xs,
        marginTop: 4,
        fontFamily: typography.fontFamily.regular,
    },
    progressBar: {
        height: 4,
        borderRadius: 2,
        marginTop: 8,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
    },
    transferStatus: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8,
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
        borderRadius: layout.borderRadius.lg,
        padding: 20,
        maxHeight: '80%',
        borderWidth: 1,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: typography.size.lg,
        fontFamily: typography.fontFamily.bold,
    },
    modalClose: {
        fontSize: 24,
    },
    modalEmpty: {
        padding: 20,
        alignItems: 'center',
    },
    modalEmptyText: {
        fontSize: typography.size.md,
        marginBottom: 8,
    },
    modalEmptySubtext: {
        fontSize: typography.size.sm,
        textAlign: 'center',
    },
    modalList: {
        maxHeight: 300,
    },
    modalButton: {
        marginTop: 16,
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    modalButtonText: {
        fontFamily: typography.fontFamily.medium,
    },
});

export default FileTransferScreen;
