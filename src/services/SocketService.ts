// Socket.io service for signaling server connection
import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Logger } from '../utils/Logger';

// WebRTC types for signaling
interface RTCSessionDescriptionInit {
    type: 'offer' | 'answer' | 'pranswer' | 'rollback';
    sdp?: string;
}

interface RTCIceCandidateInit {
    candidate?: string;
    sdpMid?: string | null;
    sdpMLineIndex?: number | null;
    usernameFragment?: string | null;
}

// Default to the SuperDesk Azure server
const DEFAULT_SERVER_URL = 'https://supderdesk-fgasbfdze6bwbbav.centralindia-01.azurewebsites.net';
const SERVER_URL_KEY = 'superdesk_server_url';

// Session types
export type SessionType = 'mobile' | 'desktop';

// Event callback types
export interface SessionCreatedData {
    sessionId: string;
}

export interface GuestJoinedData {
    guestId: string;
    sessionId: string;
}

export interface OfferData {
    offer: RTCSessionDescriptionInit;
    from: string;
    sessionId: string;
}

export interface AnswerData {
    answer: RTCSessionDescriptionInit;
    from: string;
    sessionId: string;
}

export interface IceCandidateData {
    candidate: RTCIceCandidateInit;
    from: string;
}

// Remote control input event types (received when hosting)
export interface MouseEventData {
    sessionId: string;
    type: 'move' | 'click' | 'down' | 'up' | 'scroll';
    x: number;
    y: number;
    button?: number;
    deltaX?: number;
    deltaY?: number;
}

export interface KeyboardEventData {
    sessionId: string;
    type: 'down' | 'up';
    key: string;
    code: string;
}

class SocketService {
    private socket: Socket | null = null;
    private serverUrl: string = DEFAULT_SERVER_URL;
    private currentSessionId: string | null = null;
    private initialized: boolean = false;

    // Event callbacks
    private onSessionCreatedCallback?: (data: SessionCreatedData) => void;
    private onSessionJoinedCallback?: (sessionId: string) => void;
    private onSessionErrorCallback?: (error: string) => void;
    private onGuestJoinedCallback?: (data: GuestJoinedData) => void;
    private onOfferCallback?: (data: OfferData) => void;
    private onAnswerCallback?: (data: AnswerData) => void;
    private onIceCandidateCallback?: (data: IceCandidateData) => void;
    private onScreenShareStartedCallback?: () => void;
    private onHostStoppedSharingCallback?: () => void;
    private onSessionEndedCallback?: () => void;
    private onHostDisconnectedCallback?: () => void;
    private onRemoteControlEnabledCallback?: () => void;
    private onRemoteControlDisabledCallback?: () => void;
    private onConnectedCallback?: () => void;
    private onDisconnectedCallback?: () => void;
    private onMouseEventCallback?: (data: MouseEventData) => void;
    private onKeyboardEventCallback?: (data: KeyboardEventData) => void;

    async initializeServerUrl() {
        if (this.initialized) return;
        try {
            const storedUrl = await AsyncStorage.getItem(SERVER_URL_KEY);
            if (storedUrl) {
                this.serverUrl = storedUrl;
                Logger.debug('📱 Loaded server URL:', this.serverUrl);
            }
        } catch (e) {
            Logger.warn('Failed to load server URL:', e);
        }
        this.initialized = true;
    }

    async setServerUrl(url: string) {
        this.serverUrl = url;
        await AsyncStorage.setItem(SERVER_URL_KEY, url);
        // Force reconnection
        if (this.socket) {
            this.socket.disconnect();
            this.connect();
        }
    }

    async resetServerUrl() {
        this.serverUrl = DEFAULT_SERVER_URL;
        await AsyncStorage.removeItem(SERVER_URL_KEY);
        // Force reconnection
        if (this.socket) {
            this.socket.disconnect();
            this.connect();
        }
    }

    getServerUrl(): string {
        return this.serverUrl;
    }

    async connect(serverUrl?: string): Promise<void> {
        await this.initializeServerUrl();

        return new Promise((resolve, reject) => {
            if (serverUrl) {
                this.serverUrl = serverUrl;
            }

            Logger.info('📱 Connecting to:', this.serverUrl);

            this.socket = io(this.serverUrl, {
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
                timeout: 20000,
                upgrade: true,
                path: '/socket.io/',
            });

            this.socket.on('connect', () => {
                Logger.debug('📱 Connected to signaling server');
                this.onConnectedCallback?.();
                resolve();
            });

            this.socket.on('connect_error', (error) => {
                console.error('❌ Connection error:', error);
                reject(error);
            });

            this.socket.on('disconnect', () => {
                Logger.debug('📱 Disconnected from signaling server');
                this.onDisconnectedCallback?.();
            });

            this.setupEventListeners();
        });
    }

    private setupEventListeners() {
        if (!this.socket) return;

        // Session created (host receives session ID)
        this.socket.on('session-created', (data: SessionCreatedData) => {
            Logger.debug('📱 Session created:', data.sessionId);
            this.currentSessionId = data.sessionId;
            this.onSessionCreatedCallback?.(data);
        });

        // Session joined (guest confirmation)
        this.socket.on('session-joined', (sessionId: string) => {
            Logger.debug('📱 Session joined:', sessionId);
            this.currentSessionId = sessionId;
            this.onSessionJoinedCallback?.(sessionId);
        });

        // Session error
        this.socket.on('session-error', (error: string) => {
            console.error('❌ Session error:', error);
            this.onSessionErrorCallback?.(error);
        });

        // Guest joined (host receives when someone joins)
        this.socket.on('guest-joined', (data: GuestJoinedData) => {
            Logger.debug('📱 Guest joined:', data.guestId);
            this.onGuestJoinedCallback?.(data);
        });

        // WebRTC signaling events
        this.socket.on('offer', (data: OfferData) => {
            Logger.debug('📱 Received offer from:', data.from);
            this.onOfferCallback?.(data);
        });

        this.socket.on('answer', (data: AnswerData) => {
            Logger.debug('📱 Received answer from:', data.from);
            this.onAnswerCallback?.(data);
        });

        this.socket.on('ice-candidate', (data: IceCandidateData) => {
            Logger.debug('📱 Received ICE candidate from:', data.from);
            this.onIceCandidateCallback?.(data);
        });

        // Screen share events
        this.socket.on('screen-share-started', () => {
            Logger.debug('📱 Screen share started');
            this.onScreenShareStartedCallback?.();
        });

        this.socket.on('host-stopped-sharing', () => {
            Logger.debug('📱 Host stopped sharing');
            this.onHostStoppedSharingCallback?.();
        });

        // Session lifecycle events
        this.socket.on('session-ended', () => {
            Logger.debug('📱 Session ended');
            this.currentSessionId = null;
            this.onSessionEndedCallback?.();
        });

        this.socket.on('host-disconnected', () => {
            Logger.debug('📱 Host disconnected');
            this.onHostDisconnectedCallback?.();
        });

        // Remote control events
        this.socket.on('remote-control-enabled', () => {
            Logger.debug('📱 Remote control enabled');
            this.onRemoteControlEnabledCallback?.();
        });

        this.socket.on('remote-control-disabled', () => {
            Logger.debug('📱 Remote control disabled');
            this.onRemoteControlDisabledCallback?.();
        });

        // Remote control input events (when we are host being controlled)
        this.socket.on('mouse-event', (data: MouseEventData) => {
            Logger.debug('📱 HOST received mouse event:', data.type, 'x:', data.x?.toFixed(2), 'y:', data.y?.toFixed(2));
            this.onMouseEventCallback?.(data);
        });

        this.socket.on('keyboard-event', (data: KeyboardEventData) => {
            Logger.debug('📱 HOST received keyboard event:', data.type, data.key);
            this.onKeyboardEventCallback?.(data);
        });
    }

    // ===== Session Management =====

    // Create a new session (as host)
    createSession(type: SessionType = 'mobile') {
        Logger.debug('📱 Creating session with type:', type);
        this.socket?.emit('create-session', { type });
    }

    // Join an existing session (as guest)
    joinSession(sessionId: string) {
        Logger.debug('📱 Joining session:', sessionId);
        this.socket?.emit('join-session', sessionId);
    }

    // End the current session
    endSession(sessionId?: string) {
        const id = sessionId || this.currentSessionId;
        if (id) {
            Logger.debug('📱 Ending session:', id);
            this.socket?.emit('end-session', id);
            this.currentSessionId = null;
        }
    }

    // Stop sharing (as host)
    stopSharing(sessionId?: string) {
        const id = sessionId || this.currentSessionId;
        if (id) {
            Logger.debug('📱 Stopping share for session:', id);
            this.socket?.emit('stop-sharing', { sessionId: id });
        }
    }

    // ===== WebRTC Signaling =====

    sendOffer(sessionId: string, offer: RTCSessionDescriptionInit) {
        Logger.debug('📱 Sending offer for session:', sessionId);
        this.socket?.emit('offer', { sessionId, offer });
    }

    sendAnswer(sessionId: string, answer: RTCSessionDescriptionInit) {
        Logger.debug('📱 Sending answer for session:', sessionId);
        this.socket?.emit('answer', { sessionId, answer });
    }

    sendIceCandidate(sessionId: string, candidate: RTCIceCandidateInit) {
        this.socket?.emit('ice-candidate', { sessionId, candidate });
    }

    // ===== Remote Control (via Socket.IO for server-based relay) =====
    // Note: For lowest latency, use WebRTC data channel instead

    enableRemoteControl(sessionId?: string) {
        const id = sessionId || this.currentSessionId;
        if (id) {
            this.socket?.emit('enable-remote-control', { sessionId: id });
        }
    }

    disableRemoteControl(sessionId?: string) {
        const id = sessionId || this.currentSessionId;
        if (id) {
            this.socket?.emit('disable-remote-control', { sessionId: id });
        }
    }

    // Mouse event via Socket.IO (normalized coordinates 0.0-1.0)
    sendMouseEvent(
        sessionId: string,
        type: 'move' | 'click' | 'wheel',
        x: number,
        y: number,
        options?: { button?: number; deltaX?: number; deltaY?: number }
    ) {
        this.socket?.emit('mouse-event', {
            sessionId,
            type,
            x,
            y,
            ...options,
        });
    }

    // Keyboard event via Socket.IO
    sendKeyboardEvent(
        sessionId: string,
        type: 'down' | 'up',
        key: string,
        code: string
    ) {
        this.socket?.emit('keyboard-event', {
            sessionId,
            type,
            key,
            code,
        });
    }

    // ===== Event Handlers =====

    onConnected(callback: () => void) {
        this.onConnectedCallback = callback;
    }

    onDisconnected(callback: () => void) {
        this.onDisconnectedCallback = callback;
    }

    onSessionCreated(callback: (data: SessionCreatedData) => void) {
        this.onSessionCreatedCallback = callback;
    }

    onSessionJoined(callback: (sessionId: string) => void) {
        this.onSessionJoinedCallback = callback;
    }

    onSessionError(callback: (error: string) => void) {
        this.onSessionErrorCallback = callback;
    }

    onGuestJoined(callback: (data: GuestJoinedData) => void) {
        this.onGuestJoinedCallback = callback;
    }

    onOffer(callback: (data: OfferData) => void) {
        this.onOfferCallback = callback;
    }

    onAnswer(callback: (data: AnswerData) => void) {
        this.onAnswerCallback = callback;
    }

    onIceCandidate(callback: (data: IceCandidateData) => void) {
        this.onIceCandidateCallback = callback;
    }

    onScreenShareStarted(callback: () => void) {
        this.onScreenShareStartedCallback = callback;
    }

    onHostStoppedSharing(callback: () => void) {
        this.onHostStoppedSharingCallback = callback;
    }

    onSessionEnded(callback: () => void) {
        this.onSessionEndedCallback = callback;
    }

    onHostDisconnected(callback: () => void) {
        this.onHostDisconnectedCallback = callback;
    }

    onRemoteControlEnabled(callback: () => void) {
        this.onRemoteControlEnabledCallback = callback;
    }

    onRemoteControlDisabled(callback: () => void) {
        this.onRemoteControlDisabledCallback = callback;
    }

    // Input event handlers (when this device is host being controlled)
    onMouseEvent(callback: (data: MouseEventData) => void) {
        this.onMouseEventCallback = callback;
    }

    onKeyboardEvent(callback: (data: KeyboardEventData) => void) {
        this.onKeyboardEventCallback = callback;
    }

    // ===== Utility =====

    getCurrentSessionId(): string | null {
        return this.currentSessionId;
    }

    disconnect() {
        if (this.currentSessionId) {
            this.endSession(this.currentSessionId);
        }
        this.socket?.disconnect();
        this.socket = null;
        this.currentSessionId = null;
    }

    isConnected(): boolean {
        return this.socket?.connected ?? false;
    }

    getSocket(): Socket | null {
        return this.socket;
    }
}

export const socketService = new SocketService();
export default SocketService;
