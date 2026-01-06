// TypeScript wrapper for the native RemoteControlModule

import { Logger } from '../utils/Logger';
// TypeScript wrapper for the native RemoteControlModule
import { NativeModules, Platform } from 'react-native';

const { RemoteControlModule } = NativeModules;

export interface ScreenDimensions {
    width: number;
    height: number;
}

/**
 * Remote Control Service for Android.
 * Uses the Accessibility Service to inject touch/gesture events.
 * 
 * IMPORTANT: The user must manually enable the accessibility service in:
 * Settings → Accessibility → SuperDesk Remote Control → Enable
 */
class RemoteControlService {
    /**
     * Check if the accessibility service is enabled.
     * User must manually enable it in Android Settings.
     */
    async isServiceEnabled(): Promise<boolean> {
        if (Platform.OS !== 'android') {
            return false;
        }
        return await RemoteControlModule.isServiceEnabled();
    }

    /**
     * Open Android Accessibility Settings so user can enable the service.
     */
    async openAccessibilitySettings(): Promise<boolean> {
        if (Platform.OS !== 'android') {
            throw new Error('Only supported on Android');
        }
        return await RemoteControlModule.openAccessibilitySettings();
    }

    /**
     * Get screen dimensions used for coordinate translation.
     */
    async getScreenDimensions(): Promise<ScreenDimensions> {
        if (Platform.OS !== 'android') {
            return { width: 1080, height: 1920 };
        }
        return await RemoteControlModule.getScreenDimensions();
    }

    /**
     * Perform a tap at normalized coordinates (0.0-1.0).
     * @param x Normalized X coordinate (0.0 = left, 1.0 = right)
     * @param y Normalized Y coordinate (0.0 = top, 1.0 = bottom)
     */
    async performTap(x: number, y: number): Promise<boolean> {
        if (Platform.OS !== 'android') {
            return false;
        }
        return await RemoteControlModule.performTap(x, y);
    }

    /**
     * Perform a long press at normalized coordinates.
     */
    async performLongPress(x: number, y: number): Promise<boolean> {
        if (Platform.OS !== 'android') {
            return false;
        }
        return await RemoteControlModule.performLongPress(x, y);
    }

    /**
     * Perform a swipe gesture.
     * @param startX Starting X (normalized)
     * @param startY Starting Y (normalized)
     * @param endX Ending X (normalized)
     * @param endY Ending Y (normalized)
     * @param durationMs Duration of swipe in milliseconds
     */
    async performSwipe(
        startX: number,
        startY: number,
        endX: number,
        endY: number,
        durationMs: number = 300
    ): Promise<boolean> {
        if (Platform.OS !== 'android') {
            return false;
        }
        return await RemoteControlModule.performSwipe(startX, startY, endX, endY, durationMs);
    }

    /**
     * Perform scroll at a position.
     */
    async performScroll(x: number, y: number, deltaX: number, deltaY: number): Promise<boolean> {
        if (Platform.OS !== 'android') {
            return false;
        }
        return await RemoteControlModule.performScroll(x, y, deltaX, deltaY);
    }

    /**
     * Perform a global action.
     * @param action One of: 'back', 'home', 'recents', 'notifications', 'quicksettings', 'powerdialog'
     */
    async performGlobalAction(
        action: 'back' | 'home' | 'recents' | 'notifications' | 'quicksettings' | 'powerdialog'
    ): Promise<boolean> {
        if (Platform.OS !== 'android') {
            return false;
        }
        return await RemoteControlModule.performGlobalAction(action);
    }

    /**
     * Inject text into the focused input field.
     */
    async injectText(text: string): Promise<boolean> {
        if (Platform.OS !== 'android') {
            return false;
        }
        return await RemoteControlModule.injectText(text);
    }

    /**
     * Handle incoming input event from remote (WebRTC data channel or Socket.IO).
     * This method parses the event and executes the appropriate action.
     */
    async handleRemoteInputEvent(event: {
        type: 'mouse' | 'keyboard' | 'touch';
        action: string;
        data: any;
    }): Promise<boolean> {
        try {
            const { type, action, data } = event;

            if (type === 'mouse' || type === 'touch') {
                switch (action) {
                    case 'click':
                    case 'tap':
                        Logger.debug('📱 Tap at:', data.x, data.y);
                        return await this.performTap(data.x, data.y);

                    case 'down':
                        // Mouse down - store position for potential drag or click
                        Logger.debug('📱 Mouse down at:', data.x, data.y);
                        // For now, just track it - actual tap happens on 'up'
                        return true;

                    case 'up':
                        // Mouse up - perform tap at this position
                        Logger.debug('📱 Mouse up (tap) at:', data.x, data.y);
                        return await this.performTap(data.x, data.y);

                    case 'move':
                        // Mouse move doesn't require action on mobile (no cursor)
                        return true;

                    case 'doubleClick':
                        // Double tap
                        await this.performTap(data.x, data.y);
                        await new Promise<void>((resolve) => { setTimeout(resolve, 100); });
                        return await this.performTap(data.x, data.y);

                    case 'rightClick':
                    case 'longPress':
                        return await this.performLongPress(data.x, data.y);

                    case 'scroll':
                    case 'wheel':
                        Logger.debug('📱 Scroll at:', data.x, data.y, 'delta:', data.deltaX, data.deltaY);
                        return await this.performScroll(
                            data.x || 0.5,
                            data.y || 0.5,
                            data.deltaX || 0,
                            data.deltaY || 0
                        );

                    case 'swipe':
                        return await this.performSwipe(
                            data.startX,
                            data.startY,
                            data.endX,
                            data.endY,
                            data.duration || 300
                        );

                    default:
                        console.warn('Unknown mouse/touch action:', action);
                        return false;
                }
            } else if (type === 'keyboard') {
                // Keyboard input handling
                switch (action) {
                    case 'special':
                        if (data.key === 'Escape' || data.key === 'escape') {
                            return await this.performGlobalAction('back');
                        }
                        if (data.key === 'Home' || data.key === 'home') {
                            return await this.performGlobalAction('home');
                        }
                        break;

                    case 'press':
                    case 'down':
                        // Inject text for printable characters and specific keys
                        if (data.key) {
                            // Single character (letters, numbers, symbols)
                            if (data.key.length === 1) {
                                return await this.injectText(data.key);
                            }
                            // Special keys handled by injection
                            if (data.key === 'Backspace' || data.key === 'Enter') {
                                return await this.injectText(data.key);
                            }
                        }
                        break;
                }
                Logger.debug('Keyboard event processed:', action, data.key);
                return true;
            }

            return false;
        } catch (error) {
            console.error('Error handling remote input:', error);
            return false;
        }
    }
}

export const remoteControlService = new RemoteControlService();
export default RemoteControlService;
