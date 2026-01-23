import {
    RTCPeerConnection,
    RTCSessionDescription,
    RTCIceCandidate,
    MediaStream,
    mediaDevices,
} from 'react-native-webrtc';
import { socketService, OfferData, AnswerData, IceCandidateData } from './SocketService';
import { fileTransferService } from './FileTransferService';
import { Logger } from '../utils/Logger';

// ICE server type
interface IceServer {
    urls: string | string[];
    username?: string;
    credential?: string;
}

// Fallback ICE servers
const FALLBACK_ICE_SERVERS: IceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    {
        urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:80?transport=tcp'],
        username: 'openrelayproject',
        credential: 'openrelayproject',
    },
];

// Fetch TURN/STUN configuration from server
async function fetchWebRTCConfig(): Promise<IceServer[]> {
    try {
        const serverUrl = socketService.getServerUrl();
        Logger.debug('🔧 Fetching WebRTC config from server:', serverUrl);
        const response = await fetch(`${serverUrl}/api/webrtc-config`);

        if (!response.ok) {
            Logger.warn('⚠️ Failed to fetch WebRTC config, using fallback');
            return FALLBACK_ICE_SERVERS;
        }

        const config = await response.json();
        if (config.iceServers && config.iceServers.length > 0) {
            Logger.debug('✅ Using server ICE config:', config.iceServers.length, 'servers');
            return config.iceServers;
        }
        return FALLBACK_ICE_SERVERS;
    } catch (error) {
        Logger.error('❌ Error fetching WebRTC config:', error);
        return FALLBACK_ICE_SERVERS;
    }
}

export type ConnectionRole = 'host' | 'viewer';
export type ConnectionState = 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed';

// RTCDataChannel type
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

interface RTCDataChannelEvent {
    channel: RTCDataChannel;
}

interface RTCTrackEvent {
    streams: MediaStream[];
    track: any;
}

interface RTCIceCandidateEvent {
    candidate: RTCIceCandidate | null;
}

class WebRTCService {
    private peerConnection: RTCPeerConnection | null = null;
    private localStream: MediaStream | null = null;
    private remoteStream: MediaStream | null = null;
    private dataChannel: RTCDataChannel | null = null;
    private fileDataChannel: RTCDataChannel | null = null;
    private sessionId: string | null = null;
    private role: ConnectionRole = 'viewer';
    private isRemoteDescriptionSet: boolean = false;
    private pendingIceCandidates: RTCIceCandidate[] = [];

    // Callbacks
    private onRemoteStreamCallback?: (stream: MediaStream) => void;
    private onDataChannelMessageCallback?: (message: string) => void;
    private onConnectionStateChangeCallback?: (state: ConnectionState) => void;
    private onDataChannelOpenCallback?: () => void;

    private audioStream: MediaStream | null = null;
    private audioEnabled: boolean = true;
    private isAudioShared: boolean = false;

    async initialize(role: ConnectionRole, sessionId?: string): Promise<void> {
        // Prevent double-initialization for same session
        if (this.peerConnection && this.sessionId === sessionId) {
            Logger.debug('📱 WebRTC already initialized for session:', sessionId);
            return;
        }

        // Clean up old connection if session changed
        if (this.peerConnection && this.sessionId !== sessionId) {
            Logger.debug('📱 Different session, cleaning up old connection');
            this.close();
        }

        this.role = role;
        this.sessionId = sessionId || null;
        this.isRemoteDescriptionSet = false;
        this.pendingIceCandidates = [];

        // Fetch TURN/STUN config from server
        const iceServers = await fetchWebRTCConfig();

        // Create peer connection with optimal config for low latency
        const config = {
            iceServers,
            iceTransportPolicy: 'all',
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require',
            iceCandidatePoolSize: 10,  // Pre-gather candidates for faster connection
        };

        this.peerConnection = new RTCPeerConnection(config as any);

        // Handle ICE candidates with logging
        (this.peerConnection as any).onicecandidate = (event: RTCIceCandidateEvent) => {
            if (event.candidate && this.sessionId) {
                // Log candidate type for debugging connection quality
                const candidateStr = event.candidate.candidate || '';
                let type = 'unknown';
                if (candidateStr.includes('typ host')) type = 'host (direct)';
                else if (candidateStr.includes('typ srflx')) type = 'srflx (STUN)';
                else if (candidateStr.includes('typ relay')) type = 'relay (TURN)';
                Logger.debug(`📱 ICE candidate: ${type}`);

                socketService.sendIceCandidate(this.sessionId, event.candidate.toJSON());
            }
        };

        // Handle ICE connection state for restart on failure
        (this.peerConnection as any).oniceconnectionstatechange = () => {
            const state = (this.peerConnection as any)?.iceConnectionState;
            Logger.debug('📱 ICE connection state:', state);
            if (state === 'failed') {
                Logger.debug('📱 ICE failed, attempting restart...');
                this.restartIce();
            }
        };

        // Handle remote stream (for viewer) - includes video and audio tracks
        (this.peerConnection as any).ontrack = (event: RTCTrackEvent) => {
            const track = event.track;
            Logger.debug('📱 Received remote track:', track.kind);
            Logger.debug('   - Track ID:', track.id);
            Logger.debug('   - Track enabled:', (track as any).enabled);
            Logger.debug('   - Track readyState:', track.readyState);
            Logger.debug('   - Streams count:', event.streams?.length || 0);

            if (track.kind === 'audio') {
                Logger.debug('🔊 Audio track received from remote peer!');
                // For React Native WebRTC, audio playback happens automatically
                // when the track is added to a MediaStream that's attached to RTCView
                // However, for audio-only tracks, we may need InCallManager
            }

            if (event.streams && event.streams[0]) {
                this.remoteStream = event.streams[0];
                Logger.debug('📱 Remote stream updated:');
                Logger.debug('   - Video tracks:', this.remoteStream.getVideoTracks().length);
                Logger.debug('   - Audio tracks:', this.remoteStream.getAudioTracks().length);
                this.onRemoteStreamCallback?.(this.remoteStream);
            }
        };

        // Handle connection state changes
        (this.peerConnection as any).onconnectionstatechange = () => {
            const state = (this.peerConnection as any)?.connectionState || 'unknown';
            Logger.debug('📱 Connection state:', state);
            this.onConnectionStateChangeCallback?.(state as ConnectionState);
        };

        // Set up data channels
        if (role === 'host') {
            this.setupDataChannel();
            this.setupFileDataChannel();
        } else {
            (this.peerConnection as any).ondatachannel = (event: RTCDataChannelEvent) => {
                Logger.debug('📱 Data channel received:', event.channel.label);
                if (event.channel.label === 'files' || event.channel.label === 'file-transfer' || event.channel.label === 'fileTransfer') {
                    this.fileDataChannel = event.channel;
                    this.setupFileDataChannelHandlers();
                } else if (event.channel.label === 'input') {
                    this.dataChannel = event.channel;
                    this.setupDataChannelHandlers();
                }
            };
        }

        // Set up signaling handlers
        this.setupSignalingHandlers();
    }

    private setupDataChannel() {
        if (!this.peerConnection) return;

        this.dataChannel = (this.peerConnection as any).createDataChannel('input', {
            ordered: true,
        });
        this.setupDataChannelHandlers();
    }

    private setupFileDataChannel() {
        if (!this.peerConnection) return;

        this.fileDataChannel = (this.peerConnection as any).createDataChannel('file-transfer', {
            ordered: true,
        });
        this.setupFileDataChannelHandlers();
    }

    private setupFileDataChannelHandlers() {
        if (!this.fileDataChannel) return;

        if (this.fileDataChannel.readyState === 'open') {
            Logger.debug('📁 File data channel already open');
            fileTransferService.setDataChannel(this.fileDataChannel as any);
        }

        this.fileDataChannel.onopen = () => {
            Logger.debug('📁 File data channel opened');
            fileTransferService.setDataChannel(this.fileDataChannel as any);
        };

        this.fileDataChannel.onclose = () => {
            Logger.debug('📁 File data channel closed');
        };
    }

    private setupDataChannelHandlers() {
        if (!this.dataChannel) return;

        this.dataChannel.onopen = () => {
            Logger.debug('📱 Data channel opened - ready for low-latency input');
            // Send handshake to PC to identify as Android
            try {
                this.dataChannel?.send(JSON.stringify({
                    type: 'system',
                    action: 'handshake',
                    data: { platform: 'android' }
                }));
                Logger.debug('📱 Sent handshake to PC');
            } catch (e) {
                console.warn('📱 Failed to send handshake:', e);
            }
            this.onDataChannelOpenCallback?.();
        };

        this.dataChannel.onmessage = (event: { data: string }) => {
            Logger.debug('📱 Data channel received:', event.data.substring(0, 100));
            this.onDataChannelMessageCallback?.(event.data);
        };

        this.dataChannel.onclose = () => {
            Logger.debug('📱 Data channel closed');
        };

        this.dataChannel.onerror = (error: any) => {
            console.error('📱 Data channel error:', error);
        };
    }

    private setupSignalingHandlers() {
        // Handle incoming offer (as viewer/guest)
        socketService.onOffer(async (data: OfferData) => {
            if (!this.peerConnection) return;
            Logger.debug('📱 Processing offer...');

            try {
                await this.peerConnection.setRemoteDescription(
                    new RTCSessionDescription(data.offer as any)
                );
                this.isRemoteDescriptionSet = true;

                // Add any pending ICE candidates
                await this.addPendingIceCandidates();

                const answer = await this.peerConnection.createAnswer();
                await this.peerConnection.setLocalDescription(answer);

                if (this.sessionId) {
                    socketService.sendAnswer(this.sessionId, answer);
                }
            } catch (error) {
                console.error('❌ Error handling offer:', error);
            }
        });

        // Handle incoming answer (as host)
        socketService.onAnswer(async (data: AnswerData) => {
            if (!this.peerConnection) return;
            Logger.debug('📱 Processing answer...');

            try {
                await this.peerConnection.setRemoteDescription(
                    new RTCSessionDescription(data.answer as any)
                );
                this.isRemoteDescriptionSet = true;

                // Add any pending ICE candidates
                await this.addPendingIceCandidates();
            } catch (error) {
                console.error('❌ Error handling answer:', error);
            }
        });

        // Handle incoming ICE candidates with buffering
        socketService.onIceCandidate(async (data: IceCandidateData) => {
            if (!this.peerConnection) return;

            const candidate = new RTCIceCandidate(data.candidate);

            if (this.isRemoteDescriptionSet) {
                try {
                    await this.peerConnection.addIceCandidate(candidate);
                } catch (error) {
                    console.error('❌ Error adding ICE candidate:', error);
                }
            } else {
                // Buffer candidate until remote description is set
                Logger.debug('📱 Buffering ICE candidate');
                this.pendingIceCandidates.push(candidate);
            }
        });
    }

    private async addPendingIceCandidates() {
        if (!this.peerConnection) return;

        Logger.debug('📱 Adding', this.pendingIceCandidates.length, 'buffered ICE candidates');
        for (const candidate of this.pendingIceCandidates) {
            try {
                await this.peerConnection.addIceCandidate(candidate);
            } catch (error) {
                console.error('❌ Error adding buffered ICE candidate:', error);
            }
        }
        this.pendingIceCandidates = [];
    }

    private restartIce() {
        if (this.peerConnection && this.sessionId) {
            try {
                (this.peerConnection as any).restartIce();
            } catch (error) {
                console.error('❌ Error restarting ICE:', error);
            }
        }
    }

    // Set the session ID after initialization
    setSessionId(sessionId: string) {
        this.sessionId = sessionId;
    }

    // Create and send offer (as host after guest joins)
    async createOffer(): Promise<void> {
        if (!this.peerConnection || !this.sessionId) {
            console.error('❌ Cannot create offer: no peer connection or session ID');
            return;
        }

        try {
            Logger.debug('📱 Creating offer...');
            Logger.debug('📱 Peer connection senders:', (this.peerConnection as any).getSenders?.()?.length || 'unknown');

            const offer = await this.peerConnection.createOffer({
                offerToReceiveVideo: false, // We're sending, not receiving
                offerToReceiveAudio: false,
            } as any);

            Logger.debug('📱 Offer created, SDP length:', offer.sdp?.length || 0);

            await this.peerConnection.setLocalDescription(offer);
            Logger.debug('📱 Local description set');

            socketService.sendOffer(this.sessionId, offer);
            Logger.debug('📱 Offer sent to session:', this.sessionId);
        } catch (error) {
            console.error('❌ Error creating offer:', error);
        }
    }

    // Add local stream (for screen sharing as host)
    addStream(stream: MediaStream) {
        if (!this.peerConnection) {
            console.error('❌ Cannot add stream: no peer connection');
            return;
        }

        this.localStream = stream;
        const tracks = stream.getTracks();
        Logger.debug('📱 Adding stream with', tracks.length, 'tracks');
        tracks.forEach((track) => {
            // Ensure track is enabled (not muted)
            if (!track.enabled) {
                Logger.debug('📱 Enabling track:', track.kind);
                track.enabled = true;
            }
            Logger.debug('📱 Adding track:', track.kind, 'enabled:', track.enabled, 'readyState:', track.readyState, 'muted:', (track as any).muted);
            this.peerConnection?.addTrack(track, stream);
        });
        Logger.debug('📱 All tracks added to peer connection');

        // Configure low-latency encoding for video senders
        this.configureVideoEncoders();
    }

    // Configure video encoders for low latency
    private async configureVideoEncoders() {
        if (!this.peerConnection) return;

        try {
            const senders = (this.peerConnection as any).getSenders?.() || [];
            Logger.debug('📱 Configuring', senders.length, 'senders for LOW LATENCY');

            for (const sender of senders) {
                if (sender.track?.kind === 'video') {
                    const params = sender.getParameters?.();
                    if (params) {
                        // Set encoding parameters for LOW LATENCY
                        if (!params.encodings || params.encodings.length === 0) {
                            params.encodings = [{}];
                        }

                        params.encodings[0] = {
                            ...params.encodings[0],
                            maxBitrate: 2500000,  // 2.5 Mbps - hardware encoding can handle more
                            maxFramerate: 30,     // 30fps - hardware encoding is fast enough
                            // Priority for low latency
                            priority: 'high',
                            networkPriority: 'high',
                        };

                        // Maintain framerate for lower perceived latency (hardware can handle it)
                        params.degradationPreference = 'maintain-framerate';

                        await sender.setParameters(params);
                        Logger.debug('📱 ✅ Low-latency encoding configured:', {
                            maxBitrate: params.encodings[0].maxBitrate,
                            maxFramerate: params.encodings[0].maxFramerate,
                            degradation: params.degradationPreference,
                        });
                    }
                }
            }
        } catch (error) {
            console.warn('📱 Could not configure video encoders:', error);
        }
    }

    // Helper to wait for track to be ready (producing frames)
    private async waitForTrackReady(track: any, timeoutMs: number = 5000): Promise<boolean> {
        const startTime = Date.now();

        return new Promise((resolve) => {
            const checkTrack = () => {
                const elapsed = Date.now() - startTime;
                const isReady = track.readyState === 'live' && !track.muted;

                Logger.debug(`📱 Track check [${elapsed}ms]: readyState=${track.readyState}, muted=${track.muted}, enabled=${track.enabled}`);

                if (isReady) {
                    Logger.debug('📱 ✅ Track is ready for streaming!');
                    resolve(true);
                } else if (elapsed >= timeoutMs) {
                    console.warn(`📱 ⚠️ Track readiness timeout after ${timeoutMs}ms`);
                    // Still resolve true to attempt streaming - sometimes tracks work despite muted state
                    resolve(true);
                } else {
                    // Check again in 100ms
                    setTimeout(checkTrack, 100);
                }
            };

            // Also listen for track events
            track.onunmute = () => {
                Logger.debug('📱 Track unmuted event received');
            };
            track.onended = () => {
                Logger.debug('📱 Track ended event received');
            };

            checkTrack();
        });
    }

    // Get screen capture stream (mobile hosting)
    async getDisplayMedia(): Promise<MediaStream | null> {
        try {
            Logger.debug('📱 Calling mediaDevices.getDisplayMedia...');
            const stream = await (mediaDevices as any).getDisplayMedia({
                video: {
                    // 720p at 30fps - hardware encoding can handle this with low latency
                    frameRate: { ideal: 30, max: 30 },
                    width: { ideal: 720, max: 1280 },   // 720p for good balance
                    height: { ideal: 1280, max: 1920 }, // Portrait mode for mobile
                },
                audio: false,
            });

            if (stream) {
                const tracks = stream.getTracks();
                Logger.debug('📱 getDisplayMedia success! Got', tracks.length, 'tracks');

                for (const track of tracks) {
                    // CRITICAL: Ensure track is enabled immediately
                    track.enabled = true;
                    Logger.debug('📱 Track:', track.kind, 'enabled:', track.enabled, 'readyState:', track.readyState, 'muted:', track.muted);

                    const settings = track.getSettings?.() || {};
                    Logger.debug('📱 Track settings:', JSON.stringify(settings));

                    // Wait for the track to actually be ready
                    if (track.kind === 'video') {
                        Logger.debug('📱 Waiting for video track to be ready...');
                        await this.waitForTrackReady(track, 5000);

                        // Additional delay for MediaProjection to stabilize
                        Logger.debug('📱 Adding stabilization delay...');
                        await new Promise<void>(r => setTimeout(r, 500));

                        // Log final state
                        Logger.debug('📱 Final track state: readyState:', track.readyState, 'muted:', track.muted, 'enabled:', track.enabled);
                    }
                }
            }

            return stream as MediaStream;
        } catch (error) {
            console.error('❌ Error getting display media:', error);
            return null;
        }
    }

    // Send input event through data channel (lowest latency - P2P)
    sendInputEvent(event: {
        type: 'mouse' | 'keyboard' | 'touch';
        action: string;
        data: any;
    }) {
        if (this.dataChannel?.readyState === 'open') {
            this.dataChannel.send(JSON.stringify(event));
        } else {
            console.warn('📱 Data channel not open, cannot send input');
        }
    }

    // Check if data channel is available for low-latency input
    isDataChannelOpen(): boolean {
        return this.dataChannel?.readyState === 'open';
    }

    // Event handlers
    onRemoteStream(callback: (stream: MediaStream) => void) {
        this.onRemoteStreamCallback = callback;
    }

    onDataChannelMessage(callback: (message: string) => void) {
        this.onDataChannelMessageCallback = callback;
    }

    onConnectionStateChange(callback: (state: ConnectionState) => void) {
        this.onConnectionStateChangeCallback = callback;
    }

    onDataChannelOpen(callback: () => void) {
        this.onDataChannelOpenCallback = callback;
    }

    // Get remote stream
    getRemoteStream(): MediaStream | null {
        return this.remoteStream;
    }

    // Get connection state
    getConnectionState(): ConnectionState {
        return ((this.peerConnection as any)?.connectionState || 'disconnected') as ConnectionState;
    }

    // Get connection stats (RTT, bitrate, packet loss)
    async getConnectionStats(): Promise<{
        rtt: number | null;       // Round-trip time in ms
        bitrate: number | null;   // Current video bitrate in kbps
        packetLoss: number | null; // Packet loss percentage
        jitter: number | null;    // Jitter in ms
    }> {
        const stats = {
            rtt: null as number | null,
            bitrate: null as number | null,
            packetLoss: null as number | null,
            jitter: null as number | null,
        };

        if (!this.peerConnection) return stats;

        try {
            const rtcStats = await (this.peerConnection as any).getStats();

            rtcStats.forEach((report: any) => {
                // Get RTT from candidate-pair or remote-inbound-rtp
                if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                    if (report.currentRoundTripTime !== undefined) {
                        stats.rtt = Math.round(report.currentRoundTripTime * 1000); // Convert to ms
                    }
                }

                // Get inbound video stats (as viewer receiving video)
                if (report.type === 'inbound-rtp' && report.kind === 'video') {
                    // Calculate bitrate
                    if (report.bytesReceived !== undefined && report.timestamp) {
                        stats.bitrate = Math.round((report.bytesReceived * 8) / 1000); // kbps estimate
                    }

                    // Packet loss
                    if (report.packetsLost !== undefined && report.packetsReceived !== undefined) {
                        const total = report.packetsLost + report.packetsReceived;
                        if (total > 0) {
                            stats.packetLoss = Math.round((report.packetsLost / total) * 100 * 10) / 10;
                        }
                    }

                    // Jitter
                    if (report.jitter !== undefined) {
                        stats.jitter = Math.round(report.jitter * 1000); // Convert to ms
                    }
                }
            });
        } catch (error) {
            console.warn('📱 Could not get connection stats:', error);
        }

        return stats;
    }

    // Stop screen share without closing connection (keeps data channel alive for file transfer)
    stopScreenShare() {
        Logger.debug('📱 Stopping screen share (keeping data channel alive)');
        if (this.localStream) {
            this.localStream.getTracks().forEach((track) => {
                Logger.debug('📱 Stopping track:', track.kind);
                track.stop();
            });
            this.localStream = null;
        }
        // Do NOT close peerConnection or dataChannel - keep them alive for file transfer
    }

    // ==================== AUDIO CHAT (Android audio-only for performance) ====================

    // Get audio-only stream for voice chat (no video on Android to save CPU)
    async getAudioStream(): Promise<MediaStream | null> {
        try {
            Logger.debug('🎙️ Getting audio stream for voice chat...');
            const stream = await mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                } as any,
                video: false, // No video on Android for performance
            });

            if (stream) {
                const tracks = stream.getTracks();
                Logger.debug('🎙️ Audio stream obtained:', tracks.length, 'tracks');
                tracks.forEach(track => {
                    Logger.debug('🎙️ Audio track:', track.kind, 'enabled:', track.enabled);
                });
                this.audioStream = stream;
            }

            return stream as MediaStream;
        } catch (error) {
            console.error('❌ Error getting audio stream:', error);
            return null;
        }
    }

    // Add audio track to peer connection for voice chat
    async addAudioTrack(): Promise<void> {
        if (!this.peerConnection) {
            console.error('❌ Cannot add audio: no peer connection');
            return;
        }

        if (this.isAudioShared) {
            Logger.debug('🎙️ Audio already shared, just ensuring enabled');
            this.toggleAudio(true);
            return;
        }

        if (!this.audioStream) {
            const stream = await this.getAudioStream();
            if (!stream) {
                console.warn('⚠️ Failed to get audio stream');
                return;
            }
        }

        if (this.audioStream) {
            const audioTrack = this.audioStream.getAudioTracks()[0];
            if (audioTrack) {
                Logger.debug('🎙️ Adding audio track to peer connection');
                this.peerConnection.addTrack(audioTrack, this.audioStream);
                this.audioEnabled = true;
                this.isAudioShared = true;
                Logger.debug('✅ Audio track added successfully');

                // IMPORTANT: Trigger renegotiation to send audio to remote peer
                // This is required when adding tracks mid-session
                await this.triggerRenegotiation();
            }
        }
    }

    // Trigger WebRTC renegotiation after adding a track mid-session
    private async triggerRenegotiation(): Promise<void> {
        if (!this.peerConnection || !this.sessionId) {
            console.warn('🔄 Cannot renegotiate - no peer connection or session');
            return;
        }

        Logger.debug('🔄 Triggering renegotiation for new audio track...');

        try {
            const offer = await this.peerConnection.createOffer({
                offerToReceiveVideo: true, // Keep receiving video!
                offerToReceiveAudio: true, // We want to receive audio from PC too
            } as any);
            Logger.debug('🔄 Renegotiation offer created');

            await this.peerConnection.setLocalDescription(offer);
            Logger.debug('🔄 Local description set');

            socketService.sendOffer(this.sessionId, offer);
            Logger.debug('🔄 ✅ Renegotiation offer sent - audio should now be transmitted');
        } catch (error) {
            console.error('🔄 ❌ Renegotiation failed:', error);
        }
    }

    // Toggle audio mute/unmute
    toggleAudio(enabled: boolean): void {
        if (this.audioStream) {
            const audioTracks = this.audioStream.getAudioTracks();
            audioTracks.forEach(track => {
                track.enabled = enabled;
                Logger.debug('🎙️ Audio track', enabled ? 'ENABLED' : 'DISABLED');
            });
        }
        this.audioEnabled = enabled;
    }

    // Get audio enabled state
    isAudioEnabled(): boolean {
        return this.audioEnabled;
    }

    // Stop audio stream
    stopAudioStream(): void {
        if (this.audioStream) {
            this.audioStream.getTracks().forEach(track => {
                track.stop();
                Logger.debug('🛑 Stopped audio track');
            });
            this.audioStream = null;
        }
        this.audioEnabled = true;
    }

    // Add new screen track to existing connection and renegotiate
    async addScreenTrack(stream: MediaStream): Promise<void> {
        if (!this.peerConnection) {
            throw new Error('No peer connection - call initialize() first');
        }

        Logger.debug('📱 Adding screen track to existing connection...');
        this.localStream = stream;

        const tracks = stream.getTracks();
        Logger.debug('📱 Adding', tracks.length, 'tracks');

        tracks.forEach((track) => {
            if (!track.enabled) {
                track.enabled = true;
            }
            Logger.debug('📱 Adding track:', track.kind, 'enabled:', track.enabled);
            this.peerConnection?.addTrack(track, stream);
        });

        // Configure low-latency encoding
        this.configureVideoEncoders();

        // Renegotiate to notify peer of new track
        Logger.debug('📱 Renegotiating with new track...');
        await this.createOffer();
    }

    // Get session ID
    getSessionId(): string | null {
        return this.sessionId;
    }

    // Cleanup
    close() {
        Logger.debug('📱 Closing WebRTC connection');

        this.dataChannel?.close();
        this.fileDataChannel?.close();
        this.localStream?.getTracks().forEach((track) => track.stop());
        this.audioStream?.getTracks().forEach((track) => track.stop());
        this.peerConnection?.close();

        this.dataChannel = null;
        this.fileDataChannel = null;
        this.localStream = null;
        this.audioStream = null;
        this.audioEnabled = true;
        this.remoteStream = null;
        this.peerConnection = null;
        this.sessionId = null;
        this.isRemoteDescriptionSet = false;
        this.pendingIceCandidates = [];
    }
}

export const webRTCService = new WebRTCService();
export default WebRTCService;
