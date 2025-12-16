// Chat Screen - 1-on-1 messaging
import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    StatusBar,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    Image,
    ActivityIndicator,
} from 'react-native';
import { BackIcon } from '../components/Icons';
import { messagesService, Message } from '../services/supabaseClient';
import { useTheme } from '../context/ThemeContext';

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

    // Dynamic styles based on theme
    const dynamicStyles = {
        container: { backgroundColor: colors.background },
        text: { color: colors.text },
        subText: { color: colors.subText },
        border: { borderColor: colors.border },
        input: {
            backgroundColor: colors.card,
            borderColor: colors.cardBorder,
            color: colors.text,
        },
        theirBubble: {
            backgroundColor: colors.card,
        },
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
                        <View style={[styles.messageAvatarPlaceholder, { backgroundColor: colors.iconBackground, borderColor: colors.primary }]}>
                            <Text style={[styles.messageAvatarText, { color: colors.primary }]}>
                                {username?.charAt(0).toUpperCase()}
                            </Text>
                        </View>
                    )
                )}
                {!isOwnMessage && !showAvatar && <View style={styles.avatarSpacer} />}

                <View style={[
                    styles.messageBubble,
                    isOwnMessage ? [styles.ownMessageBubble, { backgroundColor: colors.primary }] : [styles.theirMessageBubble, dynamicStyles.theirBubble]
                ]}>
                    <Text style={[
                        styles.messageText,
                        isOwnMessage ? styles.ownMessageText : [styles.theirMessageText, dynamicStyles.text]
                    ]}>
                        {item.content}
                    </Text>
                </View>
            </View>
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
            <View style={[styles.header, dynamicStyles.border]}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <BackIcon size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, dynamicStyles.text]}>@{username}</Text>
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
                        <Text style={[styles.emptyText, dynamicStyles.subText]}>
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
                <View style={[styles.inputContainer, dynamicStyles.border, dynamicStyles.container]}>
                    <TextInput
                        style={[styles.input, dynamicStyles.input]}
                        placeholder="Type a message..."
                        placeholderTextColor={colors.subText}
                        value={messageText}
                        onChangeText={setMessageText}
                        multiline
                        maxLength={1000}
                    />
                    <TouchableOpacity
                        style={[styles.sendButton, { backgroundColor: colors.primary }, !messageText.trim() && { backgroundColor: colors.primary + '40' }]}
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
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#2a2a3a',
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
    },
    headerRight: {
        width: 40,
    },
    messagesContainer: {
        flexGrow: 1,
        padding: 16,
    },
    messageContainer: {
        flexDirection: 'row',
        marginBottom: 12,
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
        backgroundColor: '#8b5cf620',
        borderWidth: 1,
        borderColor: '#8b5cf6',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    messageAvatarText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#8b5cf6',
    },
    avatarSpacer: {
        width: 40,
    },
    messageBubble: {
        maxWidth: '70%',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 18,
    },
    ownMessageBubble: {
        backgroundColor: '#8b5cf6',
        borderBottomRightRadius: 4,
    },
    theirMessageBubble: {
        backgroundColor: '#16161e',
        borderBottomLeftRadius: 4,
    },
    messageText: {
        fontSize: 15,
        lineHeight: 20,
    },
    ownMessageText: {
        color: '#fff',
    },
    theirMessageText: {
        color: '#fff',
    },
    inputContainer: {
        flexDirection: 'row',
        padding: 12,
        borderTopWidth: 1,
        borderTopColor: '#2a2a3a',
        backgroundColor: '#0a0a0f',
    },
    input: {
        flex: 1,
        backgroundColor: '#16161e',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        fontSize: 15,
        color: '#fff',
        maxHeight: 100,
        borderWidth: 1,
        borderColor: '#2a2a3a',
    },
    sendButton: {
        backgroundColor: '#8b5cf6',
        borderRadius: 20,
        paddingHorizontal: 20,
        paddingVertical: 10,
        marginLeft: 8,
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: 70,
    },
    sendButtonDisabled: {
        backgroundColor: '#8b5cf640',
    },
    sendButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 15,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
    },
});

export default ChatScreen;
