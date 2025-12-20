// Messages Screen - Display conversation list
// Redesigned with new Design System
import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    FlatList,
    Image,
    RefreshControl,
    ActivityIndicator,
} from 'react-native';
import { SettingsIcon } from '../components/Icons';
import { messagesService, Message } from '../services/supabaseClient';
import { useTheme } from '../context/ThemeContext';
import { ScreenContainer, Card } from '../components/ui'; // Button not strictly needed for list items but good to have
import { colors, typography, layout } from '../theme/designSystem';

interface MessagesScreenProps {
    navigation: any;
}

interface Conversation {
    partnerId: string;
    messages: Message[];
    lastMessage: Message;
    unreadCount: number;
}

const MessagesScreen: React.FC<MessagesScreenProps> = ({ navigation }) => {
    const { theme, colors } = useTheme();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        loadConversations();
    }, []);

    const loadConversations = async () => {
        try {
            setIsLoading(true);
            const convos = await messagesService.getConversations();
            setConversations(convos);
        } catch (error: any) {
            console.error('Failed to load conversations:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRefresh = useCallback(async () => {
        setIsRefreshing(true);
        await loadConversations();
        setIsRefreshing(false);
    }, []);

    const formatTime = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    const renderConversation = ({ item }: { item: Conversation }) => {
        const partner = item.lastMessage.sender_id === item.partnerId
            ? item.lastMessage.sender_profile
            : item.lastMessage.receiver_profile;

        const hasUnread = item.unreadCount > 0;

        return (
            <TouchableOpacity
                onPress={() => {
                    navigation.navigate('Chat', { userId: item.partnerId, username: partner?.username });
                }}
                activeOpacity={0.7}
            >
                <Card
                    variant="elevated"
                    padding="sm"
                    style={{ ...styles.conversationItem, ...(hasUnread ? styles.unreadItem : {}) }}
                >
                    <View style={styles.avatarContainer}>
                        {partner?.avatar_url ? (
                            <Image
                                source={{ uri: partner.avatar_url }}
                                style={styles.avatar}
                            />
                        ) : (
                            <View style={styles.avatarPlaceholder}>
                                <Text style={styles.avatarText}>
                                    {partner?.username?.charAt(0).toUpperCase() || '?'}
                                </Text>
                            </View>
                        )}
                        {/* Online indicator could go here */}
                    </View>

                    <View style={styles.conversationInfo}>
                        <View style={styles.conversationHeader}>
                            <Text style={styles.conversationName} numberOfLines={1}>
                                {partner?.display_name || partner?.username || 'Unknown'}
                            </Text>
                            <Text style={[styles.timestamp, hasUnread && styles.unreadTimestamp]}>
                                {formatTime(item.lastMessage.created_at)}
                            </Text>
                        </View>

                        <View style={styles.messagePreview}>
                            <Text
                                style={[
                                    styles.lastMessage,
                                    hasUnread && styles.unreadMessageText
                                ]}
                                numberOfLines={1}
                            >
                                {item.lastMessage.content}
                            </Text>
                            {hasUnread && (
                                <View style={styles.unreadBadge}>
                                    <Text style={styles.unreadCount}>{item.unreadCount}</Text>
                                </View>
                            )}
                        </View>
                    </View>
                </Card>
            </TouchableOpacity >
        );
    };

    return (
        <ScreenContainer withScroll={false}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Messages</Text>
                <TouchableOpacity
                    style={styles.settingsButton}
                    onPress={() => navigation.navigate('Settings')}
                >
                    <SettingsIcon size={24} color={colors.textSecondary} />
                </TouchableOpacity>
            </View>

            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={conversations}
                    renderItem={renderConversation}
                    keyExtractor={(item) => item.partnerId}
                    contentContainerStyle={styles.listContainer}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={handleRefresh}
                            tintColor={colors.primary}
                            colors={[colors.primary]}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyIcon}>💬</Text>
                            <Text style={styles.emptyTitle}>No Messages Yet</Text>
                            <Text style={styles.emptyText}>
                                Start a conversation with your friends to see them here.
                            </Text>
                        </View>
                    }
                />
            )}
        </ScreenContainer>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: layout.spacing.md,
        marginBottom: layout.spacing.sm,
    },
    headerTitle: {
        fontFamily: typography.fontFamily.bold,
        fontSize: typography.size.xl,
        color: colors.textPrimary,
    },
    settingsButton: {
        padding: 4,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContainer: {
        paddingBottom: layout.spacing.xl,
    },
    conversationItem: {
        flexDirection: 'row',
        marginBottom: layout.spacing.md,
        alignItems: 'center',
        backgroundColor: colors.surface,
    },
    unreadItem: {
        backgroundColor: colors.surfaceHighlight, // Slightly lighter for unread
        borderColor: colors.border,
        borderWidth: 1,
    },
    avatarContainer: {
        marginRight: layout.spacing.md,
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: colors.surfaceHighlight,
    },
    avatarPlaceholder: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: colors.primary + '20', // Low opacity primary
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.primary,
    },
    avatarText: {
        fontSize: 20,
        fontFamily: typography.fontFamily.bold,
        color: colors.primary,
    },
    conversationInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    conversationHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    conversationName: {
        fontSize: typography.size.md,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.textPrimary,
        flex: 1,
        marginRight: 8,
    },
    timestamp: {
        fontSize: 11,
        fontFamily: typography.fontFamily.regular,
        color: colors.textTertiary,
    },
    unreadTimestamp: {
        color: colors.primary,
        fontFamily: typography.fontFamily.medium,
    },
    messagePreview: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    lastMessage: {
        flex: 1,
        fontSize: typography.size.sm,
        fontFamily: typography.fontFamily.regular,
        color: colors.textSecondary,
        marginRight: 8,
    },
    unreadMessageText: {
        color: colors.textPrimary,
        fontFamily: typography.fontFamily.medium,
    },
    unreadBadge: {
        backgroundColor: colors.primary,
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 5,
    },
    unreadCount: {
        color: '#FFFFFF',
        fontSize: 10,
        fontFamily: typography.fontFamily.bold,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 60,
        paddingHorizontal: 40,
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: layout.spacing.md,
        opacity: 0.5,
    },
    emptyTitle: {
        fontSize: typography.size.lg,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.textPrimary,
        marginBottom: layout.spacing.sm,
    },
    emptyText: {
        fontSize: typography.size.md,
        fontFamily: typography.fontFamily.regular,
        color: colors.textSecondary,
        textAlign: 'center',
    },
});

export default MessagesScreen;
