// File Transfer Service - WebRTC data channel file transfers
import RNFS from 'react-native-fs';
import { Platform } from 'react-native';

// RTCDataChannel interface for react-native-webrtc
interface RTCDataChannel {
    label: string;
    readyState: 'connecting' | 'open' | 'closing' | 'closed';
    onopen: (() => void) | null;
    onclose: (() => void) | null;
    onmessage: ((event: { data: string }) => void) | null;
    onerror: ((event: any) => void) | null;
    send: (data: string) => void;
    close: () => void;
}

// Chunk size for file transfers (16KB - optimal for WebRTC data channels)
const CHUNK_SIZE = 16 * 1024;

// Message types for file transfer protocol
export type FileTransferMessageType = 'file-start' | 'file-chunk' | 'file-end' | 'file-cancel' | 'file-ack';

export interface FileTransferMessage {
    type: FileTransferMessageType;
    id: string;
    name?: string;
    size?: number;
    mimeType?: string;
    index?: number;
    total?: number;
    data?: string; // base64 encoded chunk
}

export interface TransferProgress {
    id: string;
    name: string;
    size: number;
    transferred: number;
    progress: number; // 0-100
    status: 'pending' | 'transferring' | 'completed' | 'failed' | 'cancelled';
    direction: 'send' | 'receive';
    error?: string;
}

export interface FileToSend {
    uri: string;
    name: string;
    size: number;
    type?: string;
}

// Callback types
type ProgressCallback = (progress: TransferProgress) => void;
type FileReceivedCallback = (filePath: string, fileName: string) => void;
type ErrorCallback = (error: string, transferId: string) => void;

class FileTransferService {
    private dataChannel: RTCDataChannel | null = null;
    private activeTransfers: Map<string, TransferProgress> = new Map();
    private pendingChunks: Map<string, string[]> = new Map();
    private pendingMeta: Map<string, { name: string; size: number; mimeType: string }> = new Map();

    // Callbacks
    private onProgressCallback?: ProgressCallback;
    private onFileReceivedCallback?: FileReceivedCallback;
    private onErrorCallback?: ErrorCallback;

    // Set the data channel for file transfers
    setDataChannel(channel: RTCDataChannel) {
        this.dataChannel = channel;
        this.setupChannelHandlers();
    }

    private setupChannelHandlers() {
        if (!this.dataChannel) return;

        this.dataChannel.onmessage = async (event: { data: string }) => {
            try {
                const message: FileTransferMessage = JSON.parse(event.data);
                await this.handleMessage(message);
            } catch (error) {
                console.error('❌ Error parsing file transfer message:', error);
            }
        };

        this.dataChannel.onopen = () => {
            console.log('📁 File transfer channel opened');
        };

        this.dataChannel.onclose = () => {
            console.log('📁 File transfer channel closed');
        };
    }

    private async handleMessage(message: FileTransferMessage) {
        switch (message.type) {
            case 'file-start':
                await this.handleFileStart(message);
                break;
            case 'file-chunk':
                await this.handleFileChunk(message);
                break;
            case 'file-end':
                await this.handleFileEnd(message);
                break;
            case 'file-cancel':
                this.handleFileCancel(message);
                break;
        }
    }

    private async handleFileStart(message: FileTransferMessage) {
        const { id, name, size, mimeType } = message;
        if (!id || !name || !size) return;

        console.log(`📁 Receiving file: ${name} (${this.formatSize(size)})`);

        // Store metadata
        this.pendingMeta.set(id, { name, size, mimeType: mimeType || 'application/octet-stream' });
        this.pendingChunks.set(id, []);

        // Track progress
        const progress: TransferProgress = {
            id,
            name,
            size,
            transferred: 0,
            progress: 0,
            status: 'transferring',
            direction: 'receive',
        };
        this.activeTransfers.set(id, progress);
        this.onProgressCallback?.(progress);

        // Send acknowledgment
        this.sendMessage({ type: 'file-ack', id });
    }

    private async handleFileChunk(message: FileTransferMessage) {
        const { id, data, index, total } = message;
        if (!id || !data) return;

        const chunks = this.pendingChunks.get(id);
        const meta = this.pendingMeta.get(id);
        if (!chunks || !meta) return;

        // Store chunk
        chunks.push(data);

        // Update progress
        const transfer = this.activeTransfers.get(id);
        if (transfer) {
            const chunkSize = Math.ceil(data.length * 0.75); // base64 to bytes approximation
            transfer.transferred += chunkSize;
            transfer.progress = Math.min(100, Math.round((transfer.transferred / transfer.size) * 100));
            this.onProgressCallback?.(transfer);
        }
    }

    private async handleFileEnd(message: FileTransferMessage) {
        const { id } = message;
        if (!id) return;

        const chunks = this.pendingChunks.get(id);
        const meta = this.pendingMeta.get(id);
        if (!chunks || !meta) return;

        try {
            // Combine all chunks
            const fullData = chunks.join('');

            // Save to Downloads folder
            const downloadsPath = Platform.OS === 'android'
                ? RNFS.DownloadDirectoryPath
                : RNFS.DocumentDirectoryPath;

            const filePath = `${downloadsPath}/${meta.name}`;

            // Write base64 data to file
            await RNFS.writeFile(filePath, fullData, 'base64');

            console.log(`✅ File saved: ${filePath}`);

            // Update progress
            const transfer = this.activeTransfers.get(id);
            if (transfer) {
                transfer.status = 'completed';
                transfer.progress = 100;
                this.onProgressCallback?.(transfer);
            }

            // Notify callback
            this.onFileReceivedCallback?.(filePath, meta.name);

            // Cleanup
            this.pendingChunks.delete(id);
            this.pendingMeta.delete(id);

        } catch (error: any) {
            console.error('❌ Error saving file:', error);
            const transfer = this.activeTransfers.get(id);
            if (transfer) {
                transfer.status = 'failed';
                transfer.error = error.message;
                this.onProgressCallback?.(transfer);
            }
            this.onErrorCallback?.(error.message, id);
        }
    }

    private handleFileCancel(message: FileTransferMessage) {
        const { id } = message;
        if (!id) return;

        const transfer = this.activeTransfers.get(id);
        if (transfer) {
            transfer.status = 'cancelled';
            this.onProgressCallback?.(transfer);
        }

        this.pendingChunks.delete(id);
        this.pendingMeta.delete(id);
    }

    // Send a file
    async sendFile(file: FileToSend): Promise<string> {
        if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
            throw new Error('Data channel not open');
        }

        const transferId = this.generateId();
        const { uri, name, size, type } = file;

        console.log(`📤 Sending file: ${name} (${this.formatSize(size)})`);

        // Track progress
        const progress: TransferProgress = {
            id: transferId,
            name,
            size,
            transferred: 0,
            progress: 0,
            status: 'pending',
            direction: 'send',
        };
        this.activeTransfers.set(transferId, progress);
        this.onProgressCallback?.(progress);

        try {
            // Send start message
            this.sendMessage({
                type: 'file-start',
                id: transferId,
                name,
                size,
                mimeType: type || 'application/octet-stream',
            });

            // Read file as base64
            const fileContent = await RNFS.readFile(uri, 'base64');
            const totalChunks = Math.ceil(fileContent.length / CHUNK_SIZE);

            progress.status = 'transferring';
            this.onProgressCallback?.(progress);

            // Send chunks
            for (let i = 0; i < totalChunks; i++) {
                const chunk = fileContent.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);

                this.sendMessage({
                    type: 'file-chunk',
                    id: transferId,
                    index: i,
                    total: totalChunks,
                    data: chunk,
                });

                // Update progress
                progress.transferred = Math.min(size, (i + 1) * CHUNK_SIZE * 0.75);
                progress.progress = Math.round(((i + 1) / totalChunks) * 100);
                this.onProgressCallback?.(progress);

                // Small delay to prevent overwhelming the channel
                if (i % 10 === 0) {
                    await new Promise<void>(resolve => setTimeout(resolve, 10));
                }
            }

            // Send end message
            this.sendMessage({
                type: 'file-end',
                id: transferId,
            });

            progress.status = 'completed';
            progress.progress = 100;
            this.onProgressCallback?.(progress);

            console.log(`✅ File sent: ${name}`);
            return transferId;

        } catch (error: any) {
            console.error('❌ Error sending file:', error);
            progress.status = 'failed';
            progress.error = error.message;
            this.onProgressCallback?.(progress);
            this.onErrorCallback?.(error.message, transferId);
            throw error;
        }
    }

    // Cancel a transfer
    cancelTransfer(transferId: string) {
        const transfer = this.activeTransfers.get(transferId);
        if (transfer && transfer.status === 'transferring') {
            this.sendMessage({
                type: 'file-cancel',
                id: transferId,
            });
            transfer.status = 'cancelled';
            this.onProgressCallback?.(transfer);
        }
    }

    private sendMessage(message: FileTransferMessage) {
        if (this.dataChannel?.readyState === 'open') {
            this.dataChannel.send(JSON.stringify(message));
        }
    }

    private generateId(): string {
        return `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    private formatSize(bytes: number): string {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    // Event handlers
    onProgress(callback: ProgressCallback) {
        this.onProgressCallback = callback;
    }

    onFileReceived(callback: FileReceivedCallback) {
        this.onFileReceivedCallback = callback;
    }

    onError(callback: ErrorCallback) {
        this.onErrorCallback = callback;
    }

    // Get active transfers
    getActiveTransfers(): TransferProgress[] {
        return Array.from(this.activeTransfers.values());
    }

    // Get transfer by ID
    getTransfer(id: string): TransferProgress | undefined {
        return this.activeTransfers.get(id);
    }

    // Check if channel is ready
    isReady(): boolean {
        return this.dataChannel?.readyState === 'open';
    }

    // Cleanup
    cleanup() {
        this.activeTransfers.clear();
        this.pendingChunks.clear();
        this.pendingMeta.clear();
        this.dataChannel = null;
    }
}

export const fileTransferService = new FileTransferService();
export default FileTransferService;
