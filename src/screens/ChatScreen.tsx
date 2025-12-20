// Chat Screen - 1-on-1 messaging
// Redesigned with new Design System
import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    Image,
    ActivityIndicator,
} from 'react-native';
import { BackIcon } from '../components/Icons';
import { messagesService, Message } from '../services/supabaseClient';
import { useTheme } from '../context/ThemeContext';
import { ScreenContainer } from '../components/ui';
import { colors, typography, layout } from '../theme/designSystem';

interface ChatScreenProps {
    navigation: any;
    route: {
        params: {
            userId: string;
            username: string;
        };
    };
}

const ChatScreen: React.FC<ChatScreenProps> = ({ navigation, route }) => {
    const { theme, colors } = useTheme();
    const { userId, username } = route.params;
    const [messages, setMessages] = useState<Message[]>([]);
    const [messageText, setMessageText] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    useEffect(() => {
        loadMessages();

        // Subscribe to new messages
        const subscription = messagesService.subscribeToMessages(userId, (newMessage) => {
            setMessages(prev => [...prev, newMessage]);
            scrollToBottom();
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [userId]);

    const loadMessages = async () => {
        try {
            setIsLoading(true);
            const msgs = await messagesService.getMessages(userId);
            setMessages(msgs);

            // Mark messages as read
            const unreadIds = msgs
                .filter(m => !m.read && m.sender_id === userId)
                .map(m => m.id);
            if (unreadIds.length > 0) {
                await messagesService.markAsRead(unreadIds);
            }
        } catch (error: any) {
            console.error('Failed to load messages:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSend = async () => {
        if (!messageText.trim()) return;

        const tempMessage = messageText;
        setMessageText('');
        setIsSending(true);

        try {
            const newMessage = await messagesService.sendMessage(userId, tempMessage);
            setMessages(prev => [...prev, newMessage]);
            scrollToBottom();
        } catch (error: any) {
            console.error('Failed to send message:', error);
            setMessageText(tempMessage); // Restore message on error
        } finally {
            setIsSending(false);
        }
    };

    const scrollToBottom = () => {
        setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
    };

    const renderMessage = ({ item, index }: { item: Message; index: number }) => {
        const isOwnMessage = item.sender_id !== userId;
        const showAvatar = index === 0 || messages[index - 1].sender_id !== item.sender_id;

        return (
            <View style={[
                styles.messageContainer,
                isOwnMessage ? styles.ownMessageContainer : styles.theirMessageContainer
            ]}>
                {!isOwnMessage && showAvatar && (
                    item.sender_profile?.avatar_url ? (
                        <Image
                            source={{ uri: item.sender_profile.avatar_url }}
                            style={styles.messageAvatar}
                        />
                    ) : (
                        <View style={styles.messageAvatarPlaceholder}>
                            <Text style={styles.messageAvatarText}>
                                {username?.charAt(0).toUpperCase()}
                            </Text>
                        </View>
                    )
                )}
                {!isOwnMessage && !showAvatar && <View style={styles.avatarSpacer} />}

                <View style={[
                    styles.messageBubble,
                    isOwnMessage ? styles.ownMessageBubble : styles.theirMessageBubble
                ]}>
                    <Text style={[
                        styles.messageText,
                        isOwnMessage ? styles.ownMessageText : styles.theirMessageText
                    ]}>
                        {item.content}
                    </Text>
                </View>
            </View>
        );
    };

    if (isLoading) {
        return (
            <ScreenContainer style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
            </ScreenContainer>
        );
    }

    return (
        <ScreenContainer style={styles.container} withScroll={false}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <BackIcon size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>@{username}</Text>
                <View style={styles.headerRight} />
            </View>

            {/* Messages List */}
            <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderMessage}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.messagesContainer}
                onContentSizeChange={scrollToBottom}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>
                            No messages yet. Start the conversation!
                        </Text>
                    </View>
                }
            />

            {/* Input Bar */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder="Type a message..."
                        placeholderTextColor={colors.textTertiary}
                        value={messageText}
                        onChangeText={setMessageText}
                        multiline
                        maxLength={1000}
                    />
                    <TouchableOpacity
                        style={[
                            styles.sendButton,
                            (!messageText.trim() || isSending) && styles.sendButtonDisabled
                        ]}
                        onPress={handleSend}
                        disabled={!messageText.trim() || isSending}
                    >
                        {isSending ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <Text style={styles.sendButtonText}>Send</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </ScreenContainer>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: layout.spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: typography.size.lg,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.textPrimary,
    },
    headerRight: {
        width: 32,
    },
    messagesContainer: {
        flexGrow: 1,
        padding: layout.spacing.md,
    },
    messageContainer: {
        flexDirection: 'row',
        marginBottom: layout.spacing.md,
        alignItems: 'flex-end',
    },
    ownMessageContainer: {
        justifyContent: 'flex-end',
    },
    theirMessageContainer: {
        justifyContent: 'flex-start',
    },
    messageAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginRight: 8,
    },
    messageAvatarPlaceholder: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.surfaceHighlight,
        borderWidth: 1,
        borderColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    messageAvatarText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: colors.primary,
    },
    avatarSpacer: {
        width: 40,
    },
    messageBubble: {
        maxWidth: '70%',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: layout.borderRadius.xl,
    },
    ownMessageBubble: {
        backgroundColor: colors.primary,
        borderBottomRightRadius: 4,
    },
    theirMessageBubble: {
        backgroundColor: colors.surface,
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: colors.border,
    },
    messageText: {
        fontSize: typography.size.md,
        lineHeight: 20,
        fontFamily: typography.fontFamily.regular,
    },
    ownMessageText: {
        color: '#FFFFFF',
    },
    theirMessageText: {
        color: colors.textPrimary,
    },
    inputContainer: {
        flexDirection: 'row',
        padding: layout.spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.background,
    },
    input: {
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: 24,
        paddingHorizontal: 16,
        paddingVertical: 10,
        fontSize: 15,
        color: colors.textPrimary,
        maxHeight: 100,
        borderWidth: 1,
        borderColor: colors.border,
        fontFamily: typography.fontFamily.regular,
    },
    sendButton: {
        backgroundColor: colors.primary,
        borderRadius: 24,
        paddingHorizontal: 20,
        paddingVertical: 10,
        marginLeft: 8,
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: 70,
    },
    sendButtonDisabled: {
        backgroundColor: colors.surfaceHighlight, // or utility color
        opacity: 0.5,
    },
    sendButtonText: {
        color: '#FFFFFF',
        fontFamily: typography.fontFamily.semiBold,
        fontSize: 15,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        fontSize: typography.size.md,
        color: colors.textSecondary,
        textAlign: 'center',
        fontFamily: typography.fontFamily.regular,
    },
});

export default ChatScreen;
