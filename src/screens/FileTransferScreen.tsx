// File Transfer Screen - Send and receive files via WebRTC
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
} from 'react-native';
import { pick, types, DocumentPickerResponse } from '@react-native-documents/picker';
import { SettingsIcon, FileTransferIcon } from '../components/Icons';
import { fileTransferService, TransferProgress, FileToSend } from '../services/FileTransferService';

interface FileTransferScreenProps {
    navigation: any;
}

const FileTransferScreen: React.FC<FileTransferScreenProps> = ({ navigation }) => {
    const [transfers, setTransfers] = useState<TransferProgress[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [isSending, setIsSending] = useState(false);

    useEffect(() => {
        // Check connection status
        setIsConnected(fileTransferService.isReady());

        // Listen for transfer progress updates
        fileTransferService.onProgress((progress) => {
            setTransfers(prevTransfers => {
                const existing = prevTransfers.findIndex(t => t.id === progress.id);
                if (existing >= 0) {
                    const updated = [...prevTransfers];
                    updated[existing] = progress;
                    return updated;
                }
                return [progress, ...prevTransfers];
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

        // Periodic connection check
        const interval = setInterval(() => {
            setIsConnected(fileTransferService.isReady());
        }, 2000);

        return () => clearInterval(interval);
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
        if (!isConnected) {
            Alert.alert(
                'Not Connected',
                'Please start or join a session first to send files.',
                [{ text: 'OK' }]
            );
            return;
        }

        try {
            // Pick a file
            const result = await pick({
                type: [types.allFiles],
            });

            const file = result[0];
            if (!file) return;

            setIsSending(true);

            const fileToSend: FileToSend = {
                uri: file.uri,
                name: file.name || 'unknown',
                size: file.size || 0,
                type: file.type || 'application/octet-stream',
            };

            await fileTransferService.sendFile(fileToSend);

        } catch (error: any) {
            if (error?.code !== 'DOCUMENT_PICKER_CANCELED') {
                Alert.alert('Error', error.message || 'Failed to send file');
            }
        } finally {
            setIsSending(false);
        }
    };

    const handleReceiveFiles = async () => {
        if (!isConnected) {
            Alert.alert(
                'Not Connected',
                'Please start or join a session first to receive files.',
                [{ text: 'OK' }]
            );
            return;
        }

        const hasPermission = await requestStoragePermission();
        if (!hasPermission) {
            Alert.alert('Permission Required', 'Storage permission is needed to save files.');
            return;
        }

        Alert.alert(
            'Ready to Receive',
            'Files sent from the connected PC will be saved to your Downloads folder.',
            [{ text: 'OK' }]
        );
    };

    const formatSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const formatTime = (timestamp: string): string => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0a0a0f" />

            {/* Header with Settings */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Text style={styles.logo}>File Transfer</Text>
                </View>
                <View style={styles.connectionStatus}>
                    <View style={[
                        styles.connectionDot,
                        { backgroundColor: isConnected ? '#22c55e' : '#666' }
                    ]} />
                    <Text style={styles.connectionText}>
                        {isConnected ? 'Connected' : 'Not connected'}
                    </Text>
                </View>
                <TouchableOpacity
                    style={styles.settingsButton}
                    onPress={() => navigation.navigate('Settings')}
                >
                    <SettingsIcon size={24} color="#8b5cf6" />
                </TouchableOpacity>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionsContainer}>
                <TouchableOpacity
                    style={[
                        styles.actionButton,
                        !isConnected && styles.actionButtonNotConnected,
                        isSending && styles.actionButtonDisabled
                    ]}
                    onPress={handleSendFile}
                    disabled={isSending}
                >
                    <View style={[
                        styles.actionIcon,
                        !isConnected && styles.actionIconNotConnected
                    ]}>
                        {isSending ? (
                            <ActivityIndicator size="small" color="#8b5cf6" />
                        ) : (
                            <Text style={[styles.actionEmoji, !isConnected && styles.actionEmojiDimmed]}>📤</Text>
                        )}
                    </View>
                    <Text style={[styles.actionText, !isConnected && styles.actionTextDimmed]}>
                        {isSending ? 'Sending...' : 'Send File'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.actionButton,
                        !isConnected && styles.actionButtonNotConnected
                    ]}
                    onPress={handleReceiveFiles}
                >
                    <View style={[
                        styles.actionIcon,
                        !isConnected && styles.actionIconNotConnected
                    ]}>
                        <Text style={[styles.actionEmoji, !isConnected && styles.actionEmojiDimmed]}>📥</Text>
                    </View>
                    <Text style={[styles.actionText, !isConnected && styles.actionTextDimmed]}>Receive Files</Text>
                </TouchableOpacity>
            </View>

            {/* Instructions Section */}
            <View style={styles.instructionsContainer}>
                <Text style={styles.instructionsTitle}>How to Transfer Files</Text>
                <View style={styles.instructionStep}>
                    <Text style={styles.stepNumber}>1</Text>
                    <Text style={styles.stepText}>Go to <Text style={styles.stepHighlight}>Host</Text> or <Text style={styles.stepHighlight}>Join</Text> tab</Text>
                </View>
                <View style={styles.instructionStep}>
                    <Text style={styles.stepNumber}>2</Text>
                    <Text style={styles.stepText}>Start or join a session with your PC</Text>
                </View>
                <View style={styles.instructionStep}>
                    <Text style={styles.stepNumber}>3</Text>
                    <Text style={styles.stepText}>Return here to send/receive files</Text>
                </View>
                {isConnected && (
                    <View style={styles.connectedBadge}>
                        <Text style={styles.connectedBadgeText}>✓ Ready to transfer files</Text>
                    </View>
                )}
            </View>

            {/* Transfer History */}
            <View style={styles.historyContainer}>
                <Text style={styles.historyTitle}>Transfer History</Text>

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
    connectionStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 16,
    },
    connectionDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
    connectionText: {
        color: '#888',
        fontSize: 12,
    },
    settingsButton: {
        padding: 8,
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
    connectedBadge: {
        marginTop: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: '#22c55e20',
        borderRadius: 8,
        alignSelf: 'flex-start',
    },
    connectedBadgeText: {
        color: '#22c55e',
        fontSize: 13,
        fontWeight: '600',
    },
    hintContainer: {
        backgroundColor: '#1e1e2e',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#8b5cf633',
    },
    hintText: {
        color: '#888',
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 20,
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
});

export default FileTransferScreen;
