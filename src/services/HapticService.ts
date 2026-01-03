// HapticService.ts - Manages haptic feedback for touch interactions
import ReactNativeHapticFeedback, { HapticFeedbackTypes } from 'react-native-haptic-feedback';

// Haptic options for Android and iOS
const hapticOptions = {
    enableVibrateFallback: true,  // Use device vibration if haptic engine not available
    ignoreAndroidSystemSettings: false, // Respect user's haptic settings
};

/**
 * Haptic feedback utility for providing tactile feedback on interactions.
 * Different feedback types for different actions.
 */
class HapticService {
    private enabled: boolean = true;

    /**
     * Light impact - for subtle UI interactions like toggles, switches
     */
    light() {
        if (!this.enabled) return;
        ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
    }

    /**
     * Medium impact - for standard button presses, selections
     */
    medium() {
        if (!this.enabled) return;
        ReactNativeHapticFeedback.trigger('impactMedium', hapticOptions);
    }

    /**
     * Heavy impact - for significant actions like login, connect
     */
    heavy() {
        if (!this.enabled) return;
        ReactNativeHapticFeedback.trigger('impactHeavy', hapticOptions);
    }

    /**
     * Selection changed - for picker/selection changes
     */
    selection() {
        if (!this.enabled) return;
        ReactNativeHapticFeedback.trigger('selection', hapticOptions);
    }

    /**
     * Success notification - for successful operations
     */
    success() {
        if (!this.enabled) return;
        ReactNativeHapticFeedback.trigger('notificationSuccess', hapticOptions);
    }

    /**
     * Warning notification - for warnings
     */
    warning() {
        if (!this.enabled) return;
        ReactNativeHapticFeedback.trigger('notificationWarning', hapticOptions);
    }

    /**
     * Error notification - for errors
     */
    error() {
        if (!this.enabled) return;
        ReactNativeHapticFeedback.trigger('notificationError', hapticOptions);
    }

    /**
     * Soft impact - gentle feedback for hover-like effects
     */
    soft() {
        if (!this.enabled) return;
        ReactNativeHapticFeedback.trigger('soft', hapticOptions);
    }

    /**
     * Rigid impact - crisp feedback
     */
    rigid() {
        if (!this.enabled) return;
        ReactNativeHapticFeedback.trigger('rigid', hapticOptions);
    }

    /**
     * Enable or disable haptic feedback globally
     */
    setEnabled(enabled: boolean) {
        this.enabled = enabled;
    }

    /**
     * Check if haptics are enabled
     */
    isEnabled(): boolean {
        return this.enabled;
    }
}

export const hapticService = new HapticService();
export default HapticService;
