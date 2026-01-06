// BiometricService.ts - Handles biometric authentication (FaceID/TouchID/Fingerprint)
import ReactNativeBiometrics, { BiometryType } from 'react-native-biometrics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Logger } from '../utils/Logger';

const BIOMETRICS_ENABLED_KEY = '@superdesk_biometrics_enabled';
const BIOMETRICS_TIMEOUT_KEY = '@superdesk_biometrics_timeout';
const BIOMETRICS_LAST_AUTH_KEY = '@superdesk_biometrics_last_auth';

// Timeout options in minutes (0 = always require)
export const BIOMETRIC_TIMEOUT_OPTIONS = [
    { label: 'Every time', value: 0 },
    { label: 'After 1 minute', value: 1 },
    { label: 'After 5 minutes', value: 5 },
    { label: 'After 15 minutes', value: 15 },
    { label: 'After 30 minutes', value: 30 },
    { label: 'After 1 hour', value: 60 },
];

class BiometricService {
    private rnBiometrics = new ReactNativeBiometrics({ allowDeviceCredentials: true });

    /**
     * Check if the device supports biometrics and what type.
     * Returns null if not available.
     */
    async checkAvailability(): Promise<BiometryType | null> {
        try {
            const { available, biometryType } = await this.rnBiometrics.isSensorAvailable();
            if (available) {
                Logger.debug('📱 Biometrics available:', biometryType);
                return biometryType as BiometryType;
            }
            return null;
        } catch (error) {
            console.error('Biometrics check failed:', error);
            return null;
        }
    }

    /**
     * Check if the user has enabled biometrics for login in settings.
     */
    async isEnabled(): Promise<boolean> {
        try {
            const value = await AsyncStorage.getItem(BIOMETRICS_ENABLED_KEY);
            return value === 'true';
        } catch {
            return false;
        }
    }

    /**
     * Enable or disable biometric login preference.
     */
    async setEnabled(enabled: boolean): Promise<void> {
        try {
            await AsyncStorage.setItem(BIOMETRICS_ENABLED_KEY, enabled ? 'true' : 'false');
        } catch (error) {
            console.error('Failed to save biometrics setting:', error);
        }
    }

    /**
     * Get the timeout setting in minutes (0 = always require).
     */
    async getTimeout(): Promise<number> {
        try {
            const value = await AsyncStorage.getItem(BIOMETRICS_TIMEOUT_KEY);
            return value ? parseInt(value, 10) : 0;
        } catch {
            return 0;
        }
    }

    /**
     * Set the timeout setting in minutes.
     */
    async setTimeout(minutes: number): Promise<void> {
        try {
            await AsyncStorage.setItem(BIOMETRICS_TIMEOUT_KEY, minutes.toString());
        } catch (error) {
            console.error('Failed to save biometrics timeout:', error);
        }
    }

    /**
     * Record the timestamp of a successful authentication.
     */
    async recordAuthSuccess(): Promise<void> {
        try {
            await AsyncStorage.setItem(BIOMETRICS_LAST_AUTH_KEY, Date.now().toString());
        } catch (error) {
            console.error('Failed to record auth timestamp:', error);
        }
    }

    /**
     * Check if biometric re-authentication is required based on timeout.
     */
    async isAuthRequired(): Promise<boolean> {
        try {
            const isEnabled = await this.isEnabled();
            if (!isEnabled) return false;

            const timeout = await this.getTimeout();
            if (timeout === 0) return true; // Always require

            const lastAuthStr = await AsyncStorage.getItem(BIOMETRICS_LAST_AUTH_KEY);
            if (!lastAuthStr) return true; // Never authenticated before

            const lastAuth = parseInt(lastAuthStr, 10);
            const now = Date.now();
            const elapsedMinutes = (now - lastAuth) / (1000 * 60);

            Logger.debug('📱 Biometric timeout check:', { timeout, elapsedMinutes, required: elapsedMinutes >= timeout });
            return elapsedMinutes >= timeout;
        } catch {
            return true;
        }
    }

    /**
     * Prompt user for biometric authentication.
     * Returns true if authenticated, false otherwise.
     */
    async authenticate(promptMessage: string = 'Authenticate to continue'): Promise<boolean> {
        try {
            const { success } = await this.rnBiometrics.simplePrompt({
                promptMessage,
                cancelButtonText: 'Cancel',
            });
            if (success) {
                await this.recordAuthSuccess();
            }
            return success;
        } catch (error) {
            console.error('Biometric auth failed:', error);
            return false;
        }
    }

    /**
     * Get a user-friendly name for the biometry type.
     */
    getBiometryName(type: BiometryType | null): string {
        switch (type) {
            case 'FaceID':
                return 'Face ID';
            case 'TouchID':
                return 'Touch ID';
            case 'Biometrics':
                return 'Fingerprint';
            default:
                return 'Biometrics';
        }
    }

    /**
     * Get the label for a timeout value.
     */
    getTimeoutLabel(minutes: number): string {
        const option = BIOMETRIC_TIMEOUT_OPTIONS.find(opt => opt.value === minutes);
        return option ? option.label : 'Every time';
    }
}

export const biometricService = new BiometricService();
export type { BiometryType };
