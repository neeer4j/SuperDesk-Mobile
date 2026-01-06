// SessionManager - Centralized session state management
// This service manages session state across the app, allowing navigation between
// tabs while maintaining session connection

import { socketService } from './SocketService';
import { webRTCService } from './WebRTCService';
import { Logger } from '../utils/Logger';
import { sessionHistoryService } from './SessionHistoryService';

export interface SessionState {
    isActive: boolean;
    role: 'host' | 'guest' | null;
    sessionId: string | null;
    peerId: string | null;          // Connected peer's ID
    isScreenSharing: boolean;       // Whether screen share is currently active
    isWebRTCConnected: boolean;     // Whether WebRTC connection is established
}

type SessionEventType =
    | 'stateChanged'
    | 'guestJoined'
    | 'guestLeft'
    | 'hostDisconnected'
    | 'sessionEnded'
    | 'screenShareStarted'
    | 'screenShareStopped'
    | 'error';

type EventCallback = (...args: any[]) => void;

class SessionManager {
    private static instance: SessionManager;

    // Simple event emitter implementation
    private listeners: Map<SessionEventType, Set<EventCallback>> = new Map();

    private state: SessionState = {
        isActive: false,
        role: null,
        sessionId: null,
        peerId: null,
        isScreenSharing: false,
        isWebRTCConnected: false,
    };

    // Track when session started for history recording
    private sessionStartTime: number | null = null;

    private constructor() {
        this.setupSocketListeners();
    }

    static getInstance(): SessionManager {
        if (!SessionManager.instance) {
            SessionManager.instance = new SessionManager();
        }
        return SessionManager.instance;
    }

    // Simple event emitter methods
    on(event: SessionEventType, callback: EventCallback): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(callback);
    }

    off(event: SessionEventType, callback: EventCallback): void {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.delete(callback);
        }
    }

    private emit(event: SessionEventType, ...args: any[]): void {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(...args);
                } catch (e) {
                    console.error(`[SessionManager] Error in ${event} callback:`, e);
                }
            });
        }
    }

    private setupSocketListeners() {
        // Listen for session created (as host)
        socketService.onSessionCreated((data) => {
            Logger.debug('📱 [SessionManager] Session created:', data.sessionId);
            this.sessionStartTime = Date.now();
            this.updateState({
                isActive: true,
                role: 'host',
                sessionId: data.sessionId,
            });
        });

        // Listen for guest joining (as host)
        socketService.onGuestJoined((data) => {
            Logger.debug('📱 [SessionManager] Guest joined:', data.guestId);
            this.updateState({
                peerId: data.guestId,
            });
            this.emit('guestJoined', data);
        });

        // Listen for successful join (as guest)
        socketService.onSessionJoined((sessionId) => {
            Logger.debug('📱 [SessionManager] Joined session:', sessionId);
            this.sessionStartTime = Date.now();
            this.updateState({
                isActive: true,
                role: 'guest',
                sessionId: sessionId,
            });
        });

        // Listen for host disconnection (as guest)
        socketService.onHostDisconnected(() => {
            Logger.debug('📱 [SessionManager] Host disconnected');
            this.emit('hostDisconnected');
            this.resetState();
        });

        // Listen for session ended
        socketService.onSessionEnded(() => {
            Logger.debug('📱 [SessionManager] Session ended');
            this.emit('sessionEnded');
            this.resetState();
        });

        // Listen for errors
        socketService.onSessionError((error) => {
            console.error('📱 [SessionManager] Session error:', error);
            this.emit('error', error);
        });
    }

    private updateState(partial: Partial<SessionState>) {
        const prevState = { ...this.state };
        this.state = { ...this.state, ...partial };
        Logger.debug('📱 [SessionManager] State updated:', this.state);
        this.emit('stateChanged', this.state, prevState);
    }

    private async resetState() {
        // Record session to history before clearing state
        if (this.state.isActive && this.state.sessionId && this.state.role && this.sessionStartTime) {
            const endTime = Date.now();
            const duration = Math.floor((endTime - this.sessionStartTime) / 1000);

            try {
                await sessionHistoryService.addSession({
                    sessionId: this.state.sessionId,
                    role: this.state.role,
                    startTime: this.sessionStartTime,
                    endTime: endTime,
                    duration: duration,
                    peerId: this.state.peerId || undefined,
                });
                Logger.debug('📱 [SessionManager] Session recorded to history');
            } catch (error) {
                console.error('📱 [SessionManager] Failed to record session:', error);
            }
        }

        this.sessionStartTime = null;

        this.updateState({
            isActive: false,
            role: null,
            sessionId: null,
            peerId: null,
            isScreenSharing: false,
            isWebRTCConnected: false,
        });
    }

    // === Public API ===

    getState(): SessionState {
        return { ...this.state };
    }

    isConnected(): boolean {
        return this.state.isActive && this.state.sessionId !== null;
    }

    getSessionId(): string | null {
        return this.state.sessionId;
    }

    getRole(): 'host' | 'guest' | null {
        return this.state.role;
    }

    getPeerId(): string | null {
        return this.state.peerId;
    }

    isScreenSharing(): boolean {
        return this.state.isScreenSharing;
    }

    // Create a new session as host
    async createSession(): Promise<void> {
        Logger.debug('📱 [SessionManager] Creating session...');

        return new Promise(async (resolve, reject) => {
            const timeout = setTimeout(() => {
                console.error('📱 [SessionManager] Session creation timed out');
                this.emit('error', 'Connection timed out. Server may be starting up, please try again.');
                reject(new Error('Connection timed out'));
            }, 15000);

            // Listen for session created event
            const onCreated = () => {
                clearTimeout(timeout);
                resolve();
            };
            this.on('stateChanged', (state: SessionState) => {
                if (state.isActive && state.role === 'host' && state.sessionId) {
                    onCreated();
                }
            });

            try {
                // Connect to signaling server if not connected
                if (!socketService.isConnected()) {
                    Logger.debug('📱 [SessionManager] Connecting to signaling server...');
                    await socketService.connect();
                    Logger.debug('📱 [SessionManager] Connected! Creating session...');
                }

                // Create session - the callback will update state
                socketService.createSession('mobile');
            } catch (error: any) {
                clearTimeout(timeout);
                console.error('📱 [SessionManager] Failed to create session:', error);
                this.emit('error', error.message || 'Failed to connect to server');
                reject(error);
            }
        });
    }

    // Join an existing session as guest
    async joinSession(sessionId: string): Promise<void> {
        Logger.debug('📱 [SessionManager] Joining session:', sessionId);

        try {
            // Connect to signaling server if not connected
            if (!socketService.isConnected()) {
                await socketService.connect();
            }

            // Join session - the callback will update state
            socketService.joinSession(sessionId);
        } catch (error: any) {
            console.error('📱 [SessionManager] Failed to join session:', error);
            this.emit('error', error.message || 'Failed to join session');
            throw error;
        }
    }

    // Mark screen sharing as started (called from SessionScreen)
    setScreenSharing(active: boolean) {
        this.updateState({ isScreenSharing: active });
        if (active) {
            this.emit('screenShareStarted');
        } else {
            this.emit('screenShareStopped');
        }
    }

    // Mark WebRTC as connected
    setWebRTCConnected(connected: boolean) {
        this.updateState({ isWebRTCConnected: connected });
    }

    // End the current session
    endSession() {
        Logger.debug('📱 [SessionManager] Ending session');

        if (this.state.sessionId) {
            // Stop screen sharing if active
            if (this.state.isScreenSharing) {
                webRTCService.close();
            }

            // End the socket session
            socketService.endSession(this.state.sessionId);
        }

        this.resetState();
    }

    // Refresh session code (host only)
    async refreshSessionCode(): Promise<void> {
        if (this.state.role !== 'host' || !this.state.sessionId) {
            throw new Error('Cannot refresh code: not hosting');
        }

        const oldSessionId = this.state.sessionId;

        // End old session
        socketService.endSession(oldSessionId);

        // Reset peer info but keep role
        this.updateState({
            peerId: null,
            isScreenSharing: false,
            isWebRTCConnected: false,
        });

        // Create new session
        socketService.createSession('mobile');
    }

    // Subscribe to state changes (for use in React components)
    subscribe(callback: (state: SessionState, prevState: SessionState) => void): () => void {
        this.on('stateChanged', callback);
        return () => this.off('stateChanged', callback);
    }
}

// Export singleton instance
export const sessionManager = SessionManager.getInstance();
