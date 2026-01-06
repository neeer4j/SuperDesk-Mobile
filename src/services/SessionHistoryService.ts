// SessionHistoryService - Store and retrieve session history using AsyncStorage

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@superdesk_session_history';
const MAX_HISTORY_ITEMS = 50; // Store up to 50 sessions

export interface SessionHistoryItem {
    id: string;
    sessionId: string;
    role: 'host' | 'guest';
    startTime: number;
    endTime: number;
    duration: number; // in seconds
    peerId?: string;
}

class SessionHistoryService {
    private static instance: SessionHistoryService;

    private constructor() { }

    static getInstance(): SessionHistoryService {
        if (!SessionHistoryService.instance) {
            SessionHistoryService.instance = new SessionHistoryService();
        }
        return SessionHistoryService.instance;
    }

    /**
     * Add a new session to history
     */
    async addSession(session: Omit<SessionHistoryItem, 'id'>): Promise<void> {
        try {
            const history = await this.getHistory();
            const newSession: SessionHistoryItem = {
                ...session,
                id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            };

            // Add to beginning (most recent first)
            history.unshift(newSession);

            // Keep only the last MAX_HISTORY_ITEMS
            const trimmedHistory = history.slice(0, MAX_HISTORY_ITEMS);

            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedHistory));
        } catch (error) {
            console.error('[SessionHistoryService] Failed to save session:', error);
        }
    }

    /**
     * Get session history (most recent first)
     * @param limit - Maximum number of items to return (default: 10)
     */
    async getHistory(limit: number = 50): Promise<SessionHistoryItem[]> {
        try {
            const data = await AsyncStorage.getItem(STORAGE_KEY);
            if (!data) return [];

            const history: SessionHistoryItem[] = JSON.parse(data);
            return history.slice(0, limit);
        } catch (error) {
            console.error('[SessionHistoryService] Failed to load history:', error);
            return [];
        }
    }

    /**
     * Clear all session history
     */
    async clearHistory(): Promise<void> {
        try {
            await AsyncStorage.removeItem(STORAGE_KEY);
        } catch (error) {
            console.error('[SessionHistoryService] Failed to clear history:', error);
        }
    }

    /**
     * Delete a single session from history
     */
    async deleteSession(sessionId: string): Promise<void> {
        try {
            const history = await this.getHistory();
            const filtered = history.filter(s => s.id !== sessionId);
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
        } catch (error) {
            console.error('[SessionHistoryService] Failed to delete session:', error);
        }
    }

    /**
     * Format duration in human-readable format
     */
    formatDuration(seconds: number): string {
        if (seconds < 60) {
            return `${seconds}s`;
        } else if (seconds < 3600) {
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
        } else {
            const hours = Math.floor(seconds / 3600);
            const mins = Math.floor((seconds % 3600) / 60);
            return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
        }
    }

    /**
     * Format date in human-readable format
     */
    formatDate(timestamp: number): string {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return `Today ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        } else if (diffDays === 1) {
            return `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        } else if (diffDays < 7) {
            return `${diffDays} days ago`;
        } else {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
    }
}

export const sessionHistoryService = SessionHistoryService.getInstance();
