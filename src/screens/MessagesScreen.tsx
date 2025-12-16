// Messages Screen - Display conversation list
import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    StatusBar,
    FlatList,
    Image,
    RefreshControl,
    ActivityIndicator,
} from 'react-native';
import { SettingsIcon } from '../components/Icons';
import { messagesService, Message } from '../services/supabaseClient';
import { useTheme } from '../context/ThemeContext';

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

    // Dynamic styles based on theme
    const dynamicStyles = {
        container: { backgroundColor: colors.background },
        card: { backgroundColor: colors.card, borderColor: colors.cardBorder },
        text: { color: colors.text },
        subText: { color: colors.subText },
    };

    const renderConversation = ({ item }: { item: Conversation }) => {
        const partner = item.lastMessage.sender_id === item.partnerId
            ? item.lastMessage.sender_profile
            : item.lastMessage.receiver_profile;

        return (
            <TouchableOpacity
                style={[styles.conversationItem, dynamicStyles.card]}
                onPress={() => {
                    // Navigate to chat screen (to be implemented)
                    navigation.navigate('Chat', { userId: item.partnerId, username: partner?.username });
                }}
            >
                {partner?.avatar_url ? (
                    <Image
                        source={{ uri: partner.avatar_url }}
                        style={styles.avatar}
                    />
                ) : (
                    <View style={[styles.avatarPlaceholder, { backgroundColor: colors.iconBackground, borderColor: colors.primary }]}>
                        <Text style={[styles.avatarText, { color: colors.primary }]}>
                            {partner?.username?.charAt(0).toUpperCase() || '?'}
                        </Text>
                    </View>
                )}
                <View style={styles.conversationInfo}>
                    <View style={styles.conversationHeader}>
                        <Text style={[styles.conversationName, dynamicStyles.text]}>
                            {partner?.display_name || partner?.username || 'Unknown'}
                        </Text>
                        <Text style={[styles.timestamp, dynamicStyles.subText]}>
                            {formatTime(item.lastMessage.created_at)}
                        </Text>
                    </View>
                    <View style={styles.messagePreview}>
                        <Text
                            style={[
                                styles.lastMessage,
                                dynamicStyles.subText,
                                item.unreadCount > 0 && [styles.unreadMessage, dynamicStyles.text]
                            ]}
                            numberOfLines={1}
                        >
                            {item.lastMessage.content}
                        </Text>
                        {item.unreadCount > 0 && (
                            <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
                                <Text style={styles.unreadCount}>{item.unreadCount}</Text>
                            </View>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    if (isLoading) {
        return (
            <View style={[styles.loadingContainer, dynamicStyles.container]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <View style={[styles.container, dynamicStyles.container]}>
            <StatusBar
                barStyle={theme === 'dark' ? 'light-content' : 'dark-content'}
                backgroundColor={colors.background}
            />

            {/* Header */}
            <View style={styles.header}>
                <Text style={[styles.headerTitle, dynamicStyles.text]}>Messages</Text>
                <TouchableOpacity
                    style={styles.settingsButton}
                    onPress={() => navigation.navigate('Settings')}
                >
                    <SettingsIcon size={24} color={colors.primary} />
                </TouchableOpacity>
            </View>

            {/* Conversations List */}
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
                    />
                }
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyIcon}>💬</Text>
                        <Text style={[styles.emptyTitle, dynamicStyles.text]}>No Messages Yet</Text>
                        <Text style={[styles.emptyText, dynamicStyles.subText]}>
                            Start a conversation with your friends
                        </Text>
                    </View>
                }
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a0f',
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: '#0a0a0f',
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 16,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    settingsButton: {
        padding: 8,
    },
    listContainer: {
        flexGrow: 1,
        paddingHorizontal: 20,
    },
    conversationItem: {
        flexDirection: 'row',
        backgroundColor: '#16161e',
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#2a2a3a',
    },
    avatar: {
        width: 52,
        height: 52,
        borderRadius: 26,
    },
    avatarPlaceholder: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#8b5cf620',
        borderWidth: 2,
        borderColor: '#8b5cf6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#8b5cf6',
    },
    conversationInfo: {
        flex: 1,
        marginLeft: 12,
    },
    conversationHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    conversationName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    timestamp: {
        fontSize: 12,
        color: '#666',
    },
    messagePreview: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    lastMessage: {
        flex: 1,
        fontSize: 14,
        color: '#888',
    },
    unreadMessage: {
        color: '#fff',
        fontWeight: '500',
    },
    unreadBadge: {
        backgroundColor: '#8b5cf6',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
        marginLeft: 8,
    },
    unreadCount: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 80,
    },
    emptyIcon: {
        fontSize: 64,
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
    },
});

export default MessagesScreen;
