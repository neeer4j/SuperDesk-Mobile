// Input service for translating touch gestures to mouse/keyboard events

import { Logger } from '../utils/Logger';
// Input service for translating touch gestures to mouse/keyboard events
// Uses WebRTC data channel for lowest latency (P2P) with Socket.IO fallback
import { webRTCService } from './WebRTCService';
import { socketService } from './SocketService';
import { hapticService } from './HapticService';

export interface TouchPosition {
    x: number;
    y: number;
}

export interface NormalizedPosition {
    x: number; // 0.0 to 1.0
    y: number; // 0.0 to 1.0
}

export interface InputEvent {
    type: 'mouse' | 'keyboard' | 'touch';
    action: string;
    data: any;
}

class InputService {
    private lastPosition: NormalizedPosition | null = null;
    private viewWidth: number = 0;
    private viewHeight: number = 0;
    private sessionId: string | null = null;
    private preferDataChannel: boolean = true; // Use P2P for lowest latency

    // Set the local view dimensions for coordinate normalization
    setViewSize = (width: number, height: number) => {
        this.viewWidth = width;
        this.viewHeight = height;
    }

    // Set the session ID for Socket.IO fallback
    setSessionId = (sessionId: string) => {
        this.sessionId = sessionId;
    }

    // Convert touch coordinates to normalized (0.0-1.0) coordinates
    normalizeCoordinates = (x: number, y: number): NormalizedPosition => {
        return {
            x: Math.min(1, Math.max(0, x / this.viewWidth)),
            y: Math.min(1, Math.max(0, y / this.viewHeight)),
        };
    }

    // Send input event - uses data channel if available, Socket.IO as fallback
    private sendInput = (event: InputEvent) => {
        const dataChannelOpen = webRTCService.isDataChannelOpen();
        Logger.debug(`📱 Sending input: ${event.type}:${event.action}, dataChannel=${dataChannelOpen}, sessionId=${this.sessionId}`);

        // Try data channel first (lowest latency - P2P)
        if (this.preferDataChannel && dataChannelOpen) {
            Logger.debug('📱 Using data channel for input');
            webRTCService.sendInputEvent(event);
        } else if (this.sessionId) {
            // Fallback to Socket.IO
            Logger.debug('📱 Using Socket.IO fallback for input');
            if (event.type === 'mouse') {
                socketService.sendMouseEvent(
                    this.sessionId,
                    event.action as 'move' | 'click' | 'wheel',
                    event.data.x,
                    event.data.y,
                    {
                        button: event.data.button,
                        deltaX: event.data.deltaX,
                        deltaY: event.data.deltaY,
                    }
                );
            } else if (event.type === 'keyboard') {
                socketService.sendKeyboardEvent(
                    this.sessionId,
                    event.action === 'press' ? 'down' : 'up',
                    event.data.key,
                    event.data.code || event.data.key
                );
            }
        } else {
            console.warn('📱 Cannot send input: no data channel and no sessionId');
        }
    }

    // Handle touch start (mouse down at position)
    onTouchStart = (x: number, y: number) => {
        const pos = this.normalizeCoordinates(x, y);
        this.lastPosition = pos;

        this.sendInput({
            type: 'mouse',
            action: 'down',
            data: { x: pos.x, y: pos.y },
        });
    }

    // Handle touch move (mouse move)
    onTouchMove = (x: number, y: number) => {
        const pos = this.normalizeCoordinates(x, y);
        this.lastPosition = pos;

        this.sendInput({
            type: 'mouse',
            action: 'move',
            data: { x: pos.x, y: pos.y },
        });
    }

    // Handle touch end (mouse up at last position)
    onTouchEnd = () => {
        const pos = this.lastPosition || { x: 0.5, y: 0.5 };

        this.sendInput({
            type: 'mouse',
            action: 'up',
            data: { x: pos.x, y: pos.y },
        });
    }

    // Move cursor relative to current position (for joystick)
    moveCursorRelative = (dx: number, dy: number) => {
        const currentPos = this.lastPosition || { x: 0.5, y: 0.5 };

        let newX = Math.max(0, Math.min(1, currentPos.x + dx));
        let newY = Math.max(0, Math.min(1, currentPos.y + dy));

        this.lastPosition = { x: newX, y: newY };

        this.sendInput({
            type: 'mouse',
            action: 'move',
            data: { x: newX, y: newY },
        });
    }

    // Click at current last known position (for joystick)
    clickAtLastPosition = () => {
        hapticService.light();
        const pos = this.lastPosition || { x: 0.5, y: 0.5 };

        this.sendInput({
            type: 'mouse',
            action: 'click',
            data: { x: pos.x, y: pos.y, button: 0 },
        });
    }

    // Handle single tap (left click)
    onTap = (x: number, y: number) => {
        hapticService.light();
        const pos = this.normalizeCoordinates(x, y);

        this.sendInput({
            type: 'mouse',
            action: 'click',
            data: { x: pos.x, y: pos.y, button: 0 }, // 0 = left click
        });
    }

    // Handle double tap (double click)
    onDoubleTap = (x: number, y: number) => {
        hapticService.medium();
        const pos = this.normalizeCoordinates(x, y);

        // Send two clicks quickly
        this.sendInput({
            type: 'mouse',
            action: 'click',
            data: { x: pos.x, y: pos.y, button: 0 },
        });

        setTimeout(() => {
            this.sendInput({
                type: 'mouse',
                action: 'click',
                data: { x: pos.x, y: pos.y, button: 0 },
            });
        }, 50);
    }

    // Handle long press (right click)
    onLongPress = (x: number, y: number) => {
        hapticService.heavy();
        const pos = this.normalizeCoordinates(x, y);

        this.sendInput({
            type: 'mouse',
            action: 'click',
            data: { x: pos.x, y: pos.y, button: 2 }, // 2 = right click
        });
    }

    // ...



    // Handle pinch zoom (scroll)
    onPinch = (scale: number, centerX: number, centerY: number) => {
        const pos = this.normalizeCoordinates(centerX, centerY);
        const deltaY = scale > 1 ? -100 : 100; // Pinch out = scroll up

        this.sendInput({
            type: 'mouse',
            action: 'wheel',
            data: { x: pos.x, y: pos.y, deltaX: 0, deltaY },
        });
    }

    // Handle two-finger pan (scroll)
    onTwoFingerPan = (deltaX: number, deltaY: number) => {
        const pos = this.lastPosition || { x: 0.5, y: 0.5 };

        this.sendInput({
            type: 'mouse',
            action: 'wheel',
            data: {
                x: pos.x,
                y: pos.y,
                deltaX: -deltaX * 2, // Invert and amplify for natural scrolling
                deltaY: -deltaY * 2,
            },
        });
    }

    // Send keyboard key press
    sendKeyPress = (
        key: string,
        modifiers?: { ctrl?: boolean; alt?: boolean; shift?: boolean; meta?: boolean }
    ) => {
        this.sendInput({
            type: 'keyboard',
            action: 'press',
            data: { key, code: key, ...modifiers },
        });
    }

    // Send keyboard key down
    sendKeyDown = (key: string, code?: string) => {
        this.sendInput({
            type: 'keyboard',
            action: 'down',
            data: { key, code: code || key },
        });
    }

    // Send keyboard key up
    sendKeyUp = (key: string, code?: string) => {
        this.sendInput({
            type: 'keyboard',
            action: 'up',
            data: { key, code: code || key },
        });
    }

    // Send text input (types each character)
    sendText = (text: string) => {
        for (const char of text) {
            this.sendInput({
                type: 'keyboard',
                action: 'press',
                data: { key: char, code: `Key${char.toUpperCase()}` },
            });
        }
    }

    // Send special keys
    sendSpecialKey = (
        key:
            | 'escape'
            | 'enter'
            | 'tab'
            | 'backspace'
            | 'delete'
            | 'home'
            | 'end'
            | 'pageup'
            | 'pagedown'
            | 'up'
            | 'down'
            | 'left'
            | 'right'
    ) => {
        hapticService.medium();
        const keyCodeMap: Record<string, string> = {
            escape: 'Escape',
            enter: 'Enter',
            tab: 'Tab',
            backspace: 'Backspace',
            delete: 'Delete',
            home: 'Home',
            end: 'End',
            pageup: 'PageUp',
            pagedown: 'PageDown',
            up: 'ArrowUp',
            down: 'ArrowDown',
            left: 'ArrowLeft',
            right: 'ArrowRight',
        };

        this.sendInput({
            type: 'keyboard',
            action: 'press',
            data: { key: keyCodeMap[key] || key, code: keyCodeMap[key] || key },
        });
    }

    // Set preference for data channel vs Socket.IO
    setPreferDataChannel = (prefer: boolean) => {
        this.preferDataChannel = prefer;
    }

    // Check if input is ready
    isReady = (): boolean => {
        return webRTCService.isDataChannelOpen() || !!this.sessionId;
    }
}

export const inputService = new InputService();
export default InputService;
