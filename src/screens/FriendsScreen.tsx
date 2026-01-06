// Friends Screen - Display and manage friends list
// Redesigned with new Design System
import React, { useState, useEffect, useCallback } from 'react';
import {
    FlatList,
    Alert,
    RefreshControl,
    TouchableOpacity,
    StyleSheet,
    View,
    Text,
    TextInput,
    ActivityIndicator,
    Image,
} from 'react-native';
import { BackIcon } from '../components/Icons'; // Assuming generic icons, or use specifics if available
import { friendsService, Friend } from '../services/supabaseClient';
import { useTheme } from '../context/ThemeContext';
import { ScreenContainer, Card, Button, SkeletonListItem } from '../components/ui';
import { typography, layout } from '../theme/designSystem';

import { Mail } from 'lucide-react-native';

interface FriendsScreenProps {
    navigation: any;
}

const FriendsScreen: React.FC<FriendsScreenProps> = ({ navigation }) => {
    const { theme, colors } = useTheme();
    const [friends, setFriends] = useState<Friend[]>([]);
    const [pendingRequests, setPendingRequests] = useState<Friend[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const [isAddingFriend, setIsAddingFriend] = useState(false);
    const [showPending, setShowPending] = useState(false);

    useEffect(() => {
        loadFriends();
    }, []);

    const loadFriends = async () => {
        try {
            setIsLoading(true);
            const [friendsList, requests] = await Promise.all([
                friendsService.getFriends(),
                friendsService.getPendingRequests(),
            ]);
            setFriends(friendsList);
            setPendingRequests(requests);
        } catch (error: any) {
            console.error('Failed to load friends:', error);
            // Alert.alert('Error', error.message || 'Failed to load friends');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRefresh = useCallback(async () => {
        setIsRefreshing(true);
        await loadFriends();
        setIsRefreshing(false);
    }, []);

    const handleAddFriend = async () => {
        if (!searchQuery.trim()) {
            Alert.alert('Error', 'Please enter a username');
            return;
        }

        setIsAddingFriend(true);
        try {
            await friendsService.addFriend(searchQuery.trim());
            setSearchQuery('');
            Alert.alert('Success', 'Friend request sent!');
            await loadFriends();
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to send friend request');
        } finally {
            setIsAddingFriend(false);
        }
    };

    const handleAcceptRequest = async (friendshipId: string) => {
        try {
            await friendsService.acceptFriend(friendshipId);
            Alert.alert('Success', 'Friend request accepted!');
            await loadFriends();
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to accept request');
        }
    };

    const handleRemoveFriend = async (friendshipId: string, friendName: string) => {
        Alert.alert(
            'Remove Friend',
            `Are you sure you want to remove ${friendName}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await friendsService.removeFriend(friendshipId);
                            await loadFriends();
                        } catch (error: any) {
                            Alert.alert('Error', error.message || 'Failed to remove friend');
                        }
                    },
                },
            ]
        );
    };

    const renderFriendItem = ({ item }: { item: Friend }) => (
        <Card style={styles.friendItem} padding="sm">
            <View style={styles.friendInfo}>
                <View style={styles.avatarContainer}>
                    {item.friend_profile?.avatar_url ? (
                        <Image
                            source={{ uri: item.friend_profile.avatar_url }}
                            style={styles.avatar}
                        />
                    ) : (
                        <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}>
                            <Text style={[styles.avatarText, { color: colors.primary }]}>
                                {item.friend_profile?.username?.charAt(0).toUpperCase() || '?'}
                            </Text>
                        </View>
                    )}
                </View>

                <View style={styles.textContainer}>
                    <Text style={[styles.friendName, { color: colors.text }]}>
                        {item.friend_profile?.display_name || item.friend_profile?.username}
                    </Text>
                    <Text style={[styles.friendUsername, { color: colors.subText }]}>@{item.friend_profile?.username}</Text>
                </View>
            </View>

            <Button
                variant="danger"
                size="sm"
                title="Remove"
                icon={<Text style={{ fontSize: 12 }}>🗑️</Text>}
                onPress={() => handleRemoveFriend(item.id, item.friend_profile?.username || 'this friend')}
                style={{ paddingHorizontal: 8 }}
            />
        </Card>
    );

    const renderPendingRequest = ({ item }: { item: Friend }) => (
        <Card style={{ ...styles.friendItem, ...styles.pendingItem, borderColor: colors.primary + '40' }} padding="sm">
            <View style={styles.friendInfo}>
                <View style={styles.avatarContainer}>
                    {item.friend_profile?.avatar_url ? (
                        <Image
                            source={{ uri: item.friend_profile.avatar_url }}
                            style={styles.avatar}
                        />
                    ) : (
                        <View style={styles.avatarPlaceholder}>
                            <Text style={styles.avatarText}>
                                {item.friend_profile?.username?.charAt(0).toUpperCase() || '?'}
                            </Text>
                        </View>
                    )}
                </View>

                <View style={styles.textContainer}>
                    <Text style={[styles.friendName, { color: colors.text }]}>
                        {item.friend_profile?.display_name || item.friend_profile?.username}
                    </Text>
                    <Text style={[styles.friendUsername, { color: colors.subText }]}>@{item.friend_profile?.username}</Text>
                </View>
            </View>

            <Button
                variant="primary"
                size="sm"
                title="Accept"
                onPress={() => handleAcceptRequest(item.id)}
                style={{ paddingHorizontal: 16 }}
            />
        </Card>
    );

    if (isLoading) {
        return (
            <ScreenContainer style={styles.loadingContainer}>
                <SkeletonListItem />
                <SkeletonListItem />
                <SkeletonListItem />
                <SkeletonListItem />
                <SkeletonListItem />
            </ScreenContainer>
        );
    }

    return (
        <ScreenContainer>
            {/* Header with Mail Button */}
            <View style={styles.header}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Friends</Text>
                <TouchableOpacity
                    onPress={() => setShowPending(!showPending)}
                    style={[styles.mailButton, { backgroundColor: pendingRequests.length > 0 ? colors.primary + '15' : colors.surface }]}
                    activeOpacity={0.7}
                >
                    <Mail color={pendingRequests.length > 0 ? colors.primary : colors.textSecondary} size={22} />
                    {pendingRequests.length > 0 && (
                        <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                            <Text style={styles.badgeText}>{pendingRequests.length}</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            {/* Pending Requests Section (Togglable) */}
            {showPending && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>
                        Pending Requests ({pendingRequests.length})
                    </Text>
                    {pendingRequests.length === 0 ? (
                        <Text style={{ color: colors.subText, fontStyle: 'italic', marginBottom: 10 }}>No pending requests</Text>
                    ) : (
                        <FlatList
                            data={pendingRequests}
                            renderItem={renderPendingRequest}
                            keyExtractor={(item) => item.id}
                            scrollEnabled={false}
                        />
                    )}
                </View>
            )}

            {/* Add Friend Input */}
            <View style={styles.addFriendContainer}>
                <TextInput
                    style={[styles.searchInput, { backgroundColor: colors.surfaceGlass, borderColor: colors.glassBorder, borderWidth: 1, color: colors.text }]}
                    placeholder="Enter username to add friend"
                    placeholderTextColor={colors.subText}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoCapitalize="none"
                />
                <Button
                    size="md"
                    title={isAddingFriend ? "..." : "+"}
                    onPress={handleAddFriend}
                    disabled={isAddingFriend}
                    style={styles.addButton}
                />
            </View>

            {/* Lists */}
            <View style={styles.listContainer}>
                {/* Pending requests moved to toggle section above */}

                <Text style={styles.sectionTitle}>
                    {friends.length > 0 ? `Friends (${friends.length})` : 'No Friends Yet'}
                </Text>

                <FlatList
                    data={friends}
                    renderItem={renderFriendItem}
                    keyExtractor={(item) => item.id}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={handleRefresh}
                            tintColor={colors.primary}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>Add friends using their username above</Text>
                        </View>
                    }
                />
            </View>
        </ScreenContainer>
    );
};

const styles = StyleSheet.create({
    loadingContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: layout.spacing.md,
    },
    headerTitle: {
        fontSize: typography.size.xl,
        fontFamily: typography.fontFamily.bold,
    },
    mailButton: {
        position: 'relative',
        padding: 10,
        borderRadius: layout.borderRadius.lg,
    },
    badge: {
        position: 'absolute',
        top: 4,
        right: 4,
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        paddingHorizontal: 5,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'white',
    },
    badgeText: {
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold',
    },
    logoImage: {
        width: 200,
        height: 54,
    },
    addFriendContainer: {
        flexDirection: 'row',
        marginBottom: layout.spacing.lg,
    },
    searchInput: {
        flex: 1,
        borderRadius: layout.borderRadius.md,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontFamily: typography.fontFamily.regular,
        fontSize: typography.size.md,
        marginRight: 10,
    },
    addButton: {
        width: 50, // Square button
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 0,
    },
    listContainer: {
        flex: 1,
    },
    section: {
        marginBottom: layout.spacing.lg,
    },
    sectionTitle: {
        fontSize: typography.size.sm,
        fontFamily: typography.fontFamily.semiBold,
        marginBottom: layout.spacing.sm,
        marginTop: layout.spacing.xs,
    },
    friendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: layout.spacing.sm,
    },
    pendingItem: {
        // No border, uses card background distinction
    },
    friendInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    avatarContainer: {
        marginRight: 12,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    avatarPlaceholder: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        fontSize: 16,
        fontFamily: typography.fontFamily.bold,
    },
    textContainer: {
        flex: 1,
    },
    friendName: {
        fontSize: typography.size.sm,
        fontFamily: typography.fontFamily.semiBold,
    },
    friendUsername: {
        fontSize: typography.size.xs,
        fontFamily: typography.fontFamily.regular,
    },
    emptyState: {
        paddingVertical: 40,
        alignItems: 'center',
    },
    emptyText: {
        fontFamily: typography.fontFamily.regular,
        fontSize: typography.size.md,
    },
});

export default FriendsScreen;
