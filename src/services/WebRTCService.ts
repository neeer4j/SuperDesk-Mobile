import {
    RTCPeerConnection,
    RTCSessionDescription,
    RTCIceCandidate,
    MediaStream,
    mediaDevices,
} from 'react-native-webrtc';
import { socketService, OfferData, AnswerData, IceCandidateData } from './SocketService';
import { fileTransferService } from './FileTransferService';

// Server URL for fetching WebRTC config
const SERVER_URL = 'https://superdesk-7m7f.onrender.com';

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
        console.log('🔧 Fetching WebRTC config from server...');
        const response = await fetch(`${SERVER_URL}/api/webrtc-config`);

        if (!response.ok) {
            console.warn('⚠️ Failed to fetch WebRTC config, using fallback');
            return FALLBACK_ICE_SERVERS;
        }

        const config = await response.json();
        if (config.iceServers && config.iceServers.length > 0) {
            console.log('✅ Using server ICE config:', config.iceServers.length, 'servers');
            return config.iceServers;
        }
        return FALLBACK_ICE_SERVERS;
    } catch (error) {
        console.error('❌ Error fetching WebRTC config:', error);
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

    async initialize(role: ConnectionRole, sessionId?: string): Promise<void> {
        this.role = role;
        this.sessionId = sessionId || null;
        this.isRemoteDescriptionSet = false;
        this.pendingIceCandidates = [];

        // Fetch TURN/STUN config from server
        const iceServers = await fetchWebRTCConfig();

        // Create peer connection with optimal config
        const config = {
            iceServers,
            iceTransportPolicy: 'all',
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require',
        };

        this.peerConnection = new RTCPeerConnection(config as any);

        // Handle ICE candidates
        (this.peerConnection as any).onicecandidate = (event: RTCIceCandidateEvent) => {
            if (event.candidate && this.sessionId) {
                socketService.sendIceCandidate(this.sessionId, event.candidate.toJSON());
            }
        };

        // Handle ICE connection state for restart on failure
        (this.peerConnection as any).oniceconnectionstatechange = () => {
            const state = (this.peerConnection as any)?.iceConnectionState;
            console.log('📱 ICE connection state:', state);
            if (state === 'failed') {
                console.log('📱 ICE failed, attempting restart...');
                this.restartIce();
            }
        };

        // Handle remote stream (for viewer)
        (this.peerConnection as any).ontrack = (event: RTCTrackEvent) => {
            console.log('📱 Received remote track');
            if (event.streams && event.streams[0]) {
                this.remoteStream = event.streams[0];
                this.onRemoteStreamCallback?.(this.remoteStream);
            }
        };

        // Handle connection state changes
        (this.peerConnection as any).onconnectionstatechange = () => {
            const state = (this.peerConnection as any)?.connectionState || 'unknown';
            console.log('📱 Connection state:', state);
            this.onConnectionStateChangeCallback?.(state as ConnectionState);
        };

        // Set up data channels
        if (role === 'host') {
            this.setupDataChannel();
            this.setupFileDataChannel();
        } else {
            (this.peerConnection as any).ondatachannel = (event: RTCDataChannelEvent) => {
                console.log('📱 Data channel received:', event.channel.label);
                if (event.channel.label === 'files') {
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

        this.fileDataChannel = (this.peerConnection as any).createDataChannel('files', {
            ordered: true,
        });
        this.setupFileDataChannelHandlers();
    }

    private setupFileDataChannelHandlers() {
        if (!this.fileDataChannel) return;

        this.fileDataChannel.onopen = () => {
            console.log('📁 File data channel opened');
            fileTransferService.setDataChannel(this.fileDataChannel as any);
        };

        this.fileDataChannel.onclose = () => {
            console.log('📁 File data channel closed');
        };
    }

    private setupDataChannelHandlers() {
        if (!this.dataChannel) return;

        this.dataChannel.onopen = () => {
            console.log('📱 Data channel opened - ready for low-latency input');
            this.onDataChannelOpenCallback?.();
        };

        this.dataChannel.onmessage = (event: { data: string }) => {
            this.onDataChannelMessageCallback?.(event.data);
        };

        this.dataChannel.onclose = () => {
            console.log('📱 Data channel closed');
        };

        this.dataChannel.onerror = (error: any) => {
            console.error('📱 Data channel error:', error);
        };
    }

    private setupSignalingHandlers() {
        // Handle incoming offer (as viewer/guest)
        socketService.onOffer(async (data: OfferData) => {
            if (!this.peerConnection) return;
            console.log('📱 Processing offer...');

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
            console.log('📱 Processing answer...');

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
                console.log('📱 Buffering ICE candidate');
                this.pendingIceCandidates.push(candidate);
            }
        });
    }

    private async addPendingIceCandidates() {
        if (!this.peerConnection) return;

        console.log('📱 Adding', this.pendingIceCandidates.length, 'buffered ICE candidates');
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
            console.log('📱 Creating offer...');
            console.log('📱 Peer connection senders:', (this.peerConnection as any).getSenders?.()?.length || 'unknown');

            const offer = await this.peerConnection.createOffer({
                offerToReceiveVideo: false, // We're sending, not receiving
                offerToReceiveAudio: false,
            } as any);

            console.log('📱 Offer created, SDP length:', offer.sdp?.length || 0);

            await this.peerConnection.setLocalDescription(offer);
            console.log('📱 Local description set');

            socketService.sendOffer(this.sessionId, offer);
            console.log('📱 Offer sent to session:', this.sessionId);
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
        console.log('📱 Adding stream with', tracks.length, 'tracks');
        tracks.forEach((track) => {
            // Ensure track is enabled (not muted)
            if (!track.enabled) {
                console.log('📱 Enabling track:', track.kind);
                track.enabled = true;
            }
            console.log('📱 Adding track:', track.kind, 'enabled:', track.enabled, 'readyState:', track.readyState, 'muted:', (track as any).muted);
            this.peerConnection?.addTrack(track, stream);
        });
        console.log('📱 All tracks added to peer connection');
    }

    // Helper to wait for track to be ready (producing frames)
    private async waitForTrackReady(track: any, timeoutMs: number = 5000): Promise<boolean> {
        const startTime = Date.now();

        return new Promise((resolve) => {
            const checkTrack = () => {
                const elapsed = Date.now() - startTime;
                const isReady = track.readyState === 'live' && !track.muted;

                console.log(`📱 Track check [${elapsed}ms]: readyState=${track.readyState}, muted=${track.muted}, enabled=${track.enabled}`);

                if (isReady) {
                    console.log('📱 ✅ Track is ready for streaming!');
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
                console.log('📱 Track unmuted event received');
            };
            track.onended = () => {
                console.log('📱 Track ended event received');
            };

            checkTrack();
        });
    }

    // Get screen capture stream (mobile hosting)
    async getDisplayMedia(): Promise<MediaStream | null> {
        try {
            console.log('📱 Calling mediaDevices.getDisplayMedia...');
            const stream = await (mediaDevices as any).getDisplayMedia({
                video: {
                    frameRate: 30,
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                },
                audio: false,
            });

            if (stream) {
                const tracks = stream.getTracks();
                console.log('📱 getDisplayMedia success! Got', tracks.length, 'tracks');

                for (const track of tracks) {
                    // CRITICAL: Ensure track is enabled immediately
                    track.enabled = true;
                    console.log('📱 Track:', track.kind, 'enabled:', track.enabled, 'readyState:', track.readyState, 'muted:', track.muted);

                    const settings = track.getSettings?.() || {};
                    console.log('📱 Track settings:', JSON.stringify(settings));

                    // Wait for the track to actually be ready
                    if (track.kind === 'video') {
                        console.log('📱 Waiting for video track to be ready...');
                        await this.waitForTrackReady(track, 5000);

                        // Additional delay for MediaProjection to stabilize
                        console.log('📱 Adding stabilization delay...');
                        await new Promise<void>(r => setTimeout(r, 500));

                        // Log final state
                        console.log('📱 Final track state: readyState:', track.readyState, 'muted:', track.muted, 'enabled:', track.enabled);
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

    // Get session ID
    getSessionId(): string | null {
        return this.sessionId;
    }

    // Cleanup
    close() {
        console.log('📱 Closing WebRTC connection');

        this.dataChannel?.close();
        this.fileDataChannel?.close();
        this.localStream?.getTracks().forEach((track) => track.stop());
        this.peerConnection?.close();

        this.dataChannel = null;
        this.fileDataChannel = null;
        this.localStream = null;
        this.remoteStream = null;
        this.peerConnection = null;
        this.sessionId = null;
        this.isRemoteDescriptionSet = false;
        this.pendingIceCandidates = [];
    }
}

export const webRTCService = new WebRTCService();
export default WebRTCService;
