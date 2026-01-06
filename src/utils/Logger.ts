/**
 * Logger Utility
 * Provides a centralized logging system that automatically disables
 * debug logs in production builds while preserving warnings and errors.
 * 
 * Usage:
 *   import { Logger } from '@/utils/Logger';
 *   Logger.debug('Debug message');
 *   Logger.info('Info message');
 *   Logger.warn('Warning message');
 *   Logger.error('Error message');
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class LoggerService {
    private isDevelopment: boolean;

    constructor() {
        // Use React Native's __DEV__ global variable
        this.isDevelopment = typeof __DEV__ !== 'undefined' ? __DEV__ : true;
    }

    /**
     * Debug level logging - only in development
     * Use for verbose debugging information
     */
    debug(...args: any[]): void {
        if (this.isDevelopment) {
            Logger.debug(...args);
        }
    }

    /**
     * Info level logging - only in development
     * Use for general information
     */
    info(...args: any[]): void {
        if (this.isDevelopment) {
            Logger.info(...args);
        }
    }

    /**
     * Warning level logging - enabled in all environments
     * Use for potential issues that should be monitored
     */
    warn(...args: any[]): void {
        console.warn(...args);
    }

    /**
     * Error level logging - enabled in all environments
     * Use for errors and exceptions
     */
    error(...args: any[]): void {
        console.error(...args);
    }

    /**
     * Table logging - only in development
     * Use for structured data display
     */
    table(data: any): void {
        if (this.isDevelopment && console.table) {
            console.table(data);
        }
    }

    /**
     * Group logging - only in development
     * Use for grouping related logs
     */
    group(label: string): void {
        if (this.isDevelopment && console.group) {
            console.group(label);
        }
    }

    /**
     * End group logging - only in development
     */
    groupEnd(): void {
        if (this.isDevelopment && console.groupEnd) {
            console.groupEnd();
        }
    }

    /**
     * Check if logging is enabled
     */
    isEnabled(): boolean {
        return this.isDevelopment;
    }
}

// Export singleton instance
export const Logger = new LoggerService();

// Re-export for convenience
export default Logger;
