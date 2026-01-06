// File Transfer Service - WebRTC data channel file transfers
import RNFS from 'react-native-fs';
import { Platform } from 'react-native';
import { Logger } from '../utils/Logger';

// Type declarations for browser globals
declare function atob(data: string): string;
declare function btoa(data: string): string;

// RTCDataChannel interface for react-native-webrtc
interface RTCDataChannel {
    label: string;
    readyState: 'connecting' | 'open' | 'closing' | 'closed';
    onopen: (() => void) | null;
    onclose: (() => void) | null;
    onmessage: ((event: { data: string | ArrayBuffer }) => void) | null;
    onerror: ((event: any) => void) | null;
    send: (data: string | ArrayBuffer | ArrayBufferView) => void;
    close: () => void;
    binaryType?: string;
}

// Chunk size for file transfers (16KB - optimal for WebRTC data channels)
const CHUNK_SIZE = 16 * 1024;

// Message types for file transfer protocol (Electron Compatible)
export type FileTransferMessageType =
    | 'file-offer'
    | 'file-accept'
    | 'file-reject'
    | 'file-chunk'
    | 'file-eof'
    | 'file-cancel'
    | 'toggle-enabled';

export interface FileTransferMessage {
    type: FileTransferMessageType;
    name?: string;
    size?: number;
    mimeType?: string;
    totalBytes?: number;
    enabled?: boolean;
}

export interface TransferProgress {
    id: string; // usually filename for simple implementation or generated
    name: string;
    size: number;
    transferred: number;
    progress: number; // 0-100
    status: 'pending' | 'transferring' | 'completed' | 'failed' | 'cancelled' | 'waiting-for-accept';
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

    // Check active transfers
    // Note: Electron simple implementation might only handle one at a time effectively, 
    // but we'll keep the map structure for robustness.
    private activeTransfers: Map<string, TransferProgress> = new Map();

    // For receiving
    private receivedChunks: Uint8Array[] = [];
    private bytesReceived = 0;
    private expectedFileSize = 0;
    private expectedFileName = '';
    private receivingInProgress = false;

    // For sending (waiting for accept)
    private pendingSendFile: FileToSend | null = null;
    private pendingSendId: string | null = null;

    // Callbacks
    private onProgressCallback?: ProgressCallback;
    private onFileReceivedCallback?: FileReceivedCallback;
    private onErrorCallback?: ErrorCallback;

    // Set the data channel for file transfers
    setDataChannel(channel: RTCDataChannel) {
        this.dataChannel = channel;
        // CRITICAL: Set binary type for ArrayBuffer transfer
        this.dataChannel.binaryType = 'arraybuffer';
        this.setupChannelHandlers();
    }

    private setupChannelHandlers() {
        if (!this.dataChannel) return;

        this.dataChannel.onmessage = async (event: { data: string | ArrayBuffer }) => {
            try {
                const data = event.data;
                if (typeof data === 'string') {
                    // JSON Control Message
                    const message: FileTransferMessage = JSON.parse(data);
                    await this.handleMessage(message);
                } else if (data instanceof ArrayBuffer) {
                    // Binary Chunk
                    await this.handleFileChunk(data);
                }
            } catch (error) {
                console.error('❌ Error parsing file transfer message:', error);
            }
        };

        this.dataChannel.onopen = () => {
            Logger.debug('📁 File transfer channel opened');
        };

        this.dataChannel.onclose = () => {
            Logger.debug('📁 File transfer channel closed');
            this.activeTransfers.forEach(t => {
                if (t.status === 'transferring' || t.status === 'pending' || t.status === 'waiting-for-accept') {
                    t.status = 'failed';
                    t.error = 'Channel disconnected';
                    this.onProgressCallback?.(t);
                }
            });
            this.activeTransfers.clear();
        };
    }

    private async handleMessage(message: FileTransferMessage) {
        switch (message.type) {
            case 'file-offer':
                await this.handleFileOffer(message);
                break;
            case 'file-accept':
                await this.handleFileAccept();
                break;
            case 'file-reject':
                this.handleFileReject();
                break;
            case 'file-eof':
                await this.handleFileEOF(message);
                break;
            case 'file-cancel':
                this.handleFileCancel();
                break;
        }
    }

    // ================= HANDLING RECEIVING (ANDROID RECEIVER) =================
    // Note: Focus is on SENDING to Electron, but we maintain receiving capability

    private async handleFileOffer(message: FileTransferMessage) {
        const { name, size, mimeType } = message;
        if (!name || !size) return;

        Logger.debug(`📁 Receiving file offer: ${name} (${this.formatSize(size)})`);

        // For now, AUTO ACCEPT to simplify (matches current Android logic)
        // In future we can add UI dialog to accept/reject

        const id = name; // Use name as ID for simplicity in this flow via Electron protocol

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

        // Reset receiving state
        this.receivedChunks = [];
        this.bytesReceived = 0;
        this.expectedFileSize = size;
        this.expectedFileName = name;
        this.receivingInProgress = true;

        // Send ACCEPT
        this.sendMessage({ type: 'file-accept' });
    }

    private async handleFileChunk(data: ArrayBuffer) {
        if (!this.receivingInProgress) return;

        const chunk = new Uint8Array(data);
        this.receivedChunks.push(chunk);
        this.bytesReceived += chunk.byteLength;

        const id = this.expectedFileName;
        const transfer = this.activeTransfers.get(id);

        if (transfer) {
            transfer.transferred = this.bytesReceived;
            transfer.progress = Math.min(100, Math.round((this.bytesReceived / this.expectedFileSize) * 100));
            this.onProgressCallback?.(transfer);
        }
    }

    private async handleFileEOF(message: FileTransferMessage) {
        if (!this.receivingInProgress) return;

        Logger.debug('📁 File transfer complete (EOF)');
        const id = this.expectedFileName;
        const transfer = this.activeTransfers.get(id);

        try {
            // Combine chunks
            const totalLength = this.receivedChunks.reduce((acc, c) => acc + c.length, 0);
            const combined = new Uint8Array(totalLength);
            let offset = 0;
            for (const c of this.receivedChunks) {
                combined.set(c, offset);
                offset += c.length;
            }

            // Save to Downloads
            // Note: writing binary from Uint8Array requires encoding to base64 for RNFS usually, 
            // or using specific binary write methods.
            const fullBase64 = this.uint8ArrayToBase64(combined);

            const downloadsPath = Platform.OS === 'android'
                ? RNFS.DownloadDirectoryPath
                : RNFS.DocumentDirectoryPath;

            const filePath = `${downloadsPath}/${this.expectedFileName}`;

            await RNFS.writeFile(filePath, fullBase64, 'base64');
            Logger.debug(`✅ File saved: ${filePath}`);

            if (transfer) {
                transfer.status = 'completed';
                transfer.progress = 100;
                this.onProgressCallback?.(transfer);
            }

            this.onFileReceivedCallback?.(filePath, this.expectedFileName);

        } catch (error: any) {
            console.error('❌ Error saving file:', error);
            if (transfer) {
                transfer.status = 'failed';
                transfer.error = error.message;
                this.onProgressCallback?.(transfer);
            }
        } finally {
            // Cleanup
            this.receivingInProgress = false;
            this.receivedChunks = [];
            this.bytesReceived = 0;
        }
    }

    private uint8ArrayToBase64(bytes: Uint8Array): string {
        const CHUNK_SIZE = 0x8000;
        const chunks: string[] = [];
        for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
            chunks.push(String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK_SIZE))));
        }
        const binary = chunks.join('');
        // Use react-native's btoa if available, otherwise manual encoding
        if (typeof btoa !== 'undefined') {
            return btoa(binary);
        }
        // Fallback manual base64 encoding
        const base64chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        let result = '';
        for (let i = 0; i < binary.length; i += 3) {
            const a = binary.charCodeAt(i);
            const b = i + 1 < binary.length ? binary.charCodeAt(i + 1) : 0;
            const c = i + 2 < binary.length ? binary.charCodeAt(i + 2) : 0;
            const bitmap = (a << 16) | (b << 8) | c;
            result += base64chars[(bitmap >> 18) & 63];
            result += base64chars[(bitmap >> 12) & 63];
            result += i + 1 < binary.length ? base64chars[(bitmap >> 6) & 63] : '=';
            result += i + 2 < binary.length ? base64chars[bitmap & 63] : '=';
        }
        return result;
    }

    // ================= HANDLING SENDING (ANDROID SENDER) =================

    // Step 1: User calls sendFile -> Sends Offer
    async sendFile(file: FileToSend): Promise<string> {
        if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
            throw new Error('Data channel not open');
        }

        const transferId = file.name;
        this.pendingSendFile = file;
        this.pendingSendId = transferId;

        Logger.debug(`📤 Sending file OFFER: ${file.name} (${this.formatSize(file.size)})`);

        const progress: TransferProgress = {
            id: transferId,
            name: file.name,
            size: file.size,
            transferred: 0,
            progress: 0,
            status: 'waiting-for-accept', // New status
            direction: 'send',
        };
        this.activeTransfers.set(transferId, progress);
        this.onProgressCallback?.(progress);

        try {
            this.sendMessage({
                type: 'file-offer',
                name: file.name,
                size: file.size,
                mimeType: file.type || 'application/octet-stream'
            });
            return transferId;
        } catch (error: any) {
            progress.status = 'failed';
            progress.error = error.message;
            this.onProgressCallback?.(progress);
            throw error;
        }
    }

    // Step 2: Peer sends 'file-accept' -> Start sending chunks
    private async handleFileAccept() {
        if (!this.pendingSendFile || !this.pendingSendId) {
            console.warn('📁 Received accept but no pending file to send');
            return;
        }

        Logger.debug('📁 Peer accepted file, starting transfer...');

        const file = this.pendingSendFile;
        const id = this.pendingSendId;
        const transfer = this.activeTransfers.get(id);

        if (transfer) {
            transfer.status = 'transferring';
            this.onProgressCallback?.(transfer);
        }

        try {
            // Read file as base64 (RNFS reads as base64 by default/option)
            // We need to convert to byte array to send binary chunks efficiently over wire
            // This does convert to memory, for very large files stream reading is better 
            // but Electron implementation loads to memory too.
            const fileBase64 = await RNFS.readFile(file.uri, 'base64');

            // Convert base64 to Uint8Array
            const binary = atob(fileBase64);
            const len = binary.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binary.charCodeAt(i);
            }

            const totalChunks = Math.ceil(len / CHUNK_SIZE);
            let offset = 0;

            for (let i = 0; i < totalChunks; i++) {
                // Check if cancelled
                if (this.activeTransfers.get(id)?.status === 'cancelled') {
                    Logger.debug('📁 Transfer cancelled during send');
                    return;
                }

                const chunk = bytes.slice(offset, offset + CHUNK_SIZE);
                offset += chunk.length;

                // Send Binary Chunk
                this.dataChannel!.send(chunk);

                // Update progress
                if (transfer) {
                    transfer.transferred = offset;
                    transfer.progress = Math.round((offset / file.size) * 100);
                    this.onProgressCallback?.(transfer);
                }

                // Flow control / Throttling to prevent buffer overflows
                // Simple delay - optimize if needed
                if (i % 20 === 0) {
                    await new Promise<void>(resolve => setTimeout(resolve, 10));
                }
            }

            // Send EOF
            this.sendMessage({
                type: 'file-eof',
                name: file.name,
                size: file.size,
                totalBytes: offset
            });

            Logger.debug('✅ File transfer complete');

            if (transfer) {
                transfer.status = 'completed';
                transfer.progress = 100;
                this.onProgressCallback?.(transfer);
            }

        } catch (error: any) {
            console.error('❌ Error sending chunks:', error);
            if (transfer) {
                transfer.status = 'failed';
                transfer.error = error.message;
                this.onProgressCallback?.(transfer);
            }
            this.onErrorCallback?.(error.message, id);
        } finally {
            this.pendingSendFile = null;
            this.pendingSendId = null;
        }
    }

    private handleFileReject() {
        Logger.debug('📁 File offer rejected');
        if (this.pendingSendId) {
            const transfer = this.activeTransfers.get(this.pendingSendId);
            if (transfer) {
                transfer.status = 'failed';
                transfer.error = 'Rejected by peer';
                this.onProgressCallback?.(transfer);
            }
            this.pendingSendFile = null;
            this.pendingSendId = null;
        }
    }

    private handleFileCancel() {
        Logger.debug('📁 Transfer cancelled by peer');
        this.receivingInProgress = false;
        this.receivedChunks = [];
        // Update UI if needed
    }

    // Cancel a transfer
    cancelTransfer(transferId: string) {
        const transfer = this.activeTransfers.get(transferId);
        if (transfer && (transfer.status === 'transferring' || transfer.status === 'waiting-for-accept')) {
            this.sendMessage({
                type: 'file-cancel'
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

    // Check if channel is ready
    isReady(): boolean {
        return this.dataChannel?.readyState === 'open';
    }

    // Cleanup
    cleanup() {
        this.activeTransfers.clear();
        this.receivedChunks = [];
        this.pendingSendFile = null;
        this.dataChannel = null;
    }
}

export const fileTransferService = new FileTransferService();
export default FileTransferService;
