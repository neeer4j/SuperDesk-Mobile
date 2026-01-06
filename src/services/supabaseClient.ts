// Supabase Client Configuration with OTP Auth

import { Logger } from '../utils/Logger';
// Supabase Client Configuration with OTP Auth
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, Session, User } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@env';

// Validate environment variables
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
        'Missing Supabase environment variables. Please check your .env file.'
    );
}

// Create Supabase client with AsyncStorage for persistent sessions
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});

// Profile type matching Supabase 'profiles' table schema
export interface UserProfile {
    id: string;
    email: string | null;
    display_name: string | null;
    avatar_url: string | null;
    status: string | null;
    username: string;
    created_at?: string;
    updated_at?: string;
}

// Auth helper functions for OTP
export const authService = {
    // Send OTP to email
    sendOTP: async (email: string) => {
        const { data, error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                shouldCreateUser: true,
            },
        });
        if (error) throw error;
        return data;
    },

    // Verify OTP code
    verifyOTP: async (email: string, token: string) => {
        const { data, error } = await supabase.auth.verifyOtp({
            email,
            token,
            type: 'email',
        });
        if (error) throw error;
        return data;
    },

    // Sign out
    signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    },

    // Get current session
    getSession: async (): Promise<Session | null> => {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        return data.session;
    },

    // Get current auth user
    getUser: async (): Promise<User | null> => {
        const { data, error } = await supabase.auth.getUser();
        if (error) return null;
        return data.user;
    },

    // Get user profile from the 'profiles' table
    getUserProfile: async (): Promise<UserProfile | null> => {
        const user = await authService.getUser();
        if (!user) return null;

        // Fetch from 'profiles' table
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('id, email, display_name, avatar_url, status, username, created_at, updated_at')
            .eq('id', user.id)
            .single();

        if (error || !profile) {
            Logger.debug('Profile fetch error:', error);
            // Return fallback with auth data
            return {
                id: user.id,
                email: user.email || null,
                display_name: null,
                avatar_url: null,
                status: null,
                username: user.email?.split('@')[0] || 'User',
            };
        }

        return profile as UserProfile;
    },

    // Update user profile in the 'profiles' table
    updateProfile: async (updates: { username?: string; display_name?: string; avatar_url?: string }) => {
        const user = await authService.getUser();
        if (!user) throw new Error('Not authenticated');

        const { error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', user.id);

        if (error) throw error;
    },

    // Listen to auth state changes
    onAuthStateChange: (callback: (event: string, session: Session | null) => void) => {
        return supabase.auth.onAuthStateChange(callback);
    },
};

// Friends type matching Supabase 'friends' table schema
export interface Friend {
    id: string;
    user_id: string;
    friend_id: string;
    status: 'pending' | 'accepted' | 'blocked';
    created_at: string;
    updated_at: string;
    friend_profile?: UserProfile;
}

// Message type matching Supabase 'messages' table schema
export interface Message {
    id: string;
    sender_id: string;
    receiver_id: string;
    content: string;
    message_type: string;
    session_code: string | null;
    read: boolean;
    created_at: string;
    sender_profile?: UserProfile;
    receiver_profile?: UserProfile;
}

// Friends service functions
export const friendsService = {
    // Get user's friends list
    getFriends: async () => {
        const user = await authService.getUser();
        if (!user) throw new Error('Not authenticated');

        // Get friends records where user is either sender or receiver and status is accepted
        const { data: friendsData, error } = await supabase
            .from('friends')
            .select('*')
            .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
            .eq('status', 'accepted')
            .order('created_at', { ascending: false });

        if (error) throw error;
        if (!friendsData || friendsData.length === 0) return [];

        // Collect all other user IDs
        const otherUserIds = friendsData.map((f: any) =>
            f.user_id === user.id ? f.friend_id : f.user_id
        );

        // Get profiles for all these users
        const { data: profiles } = await supabase
            .from('profiles')
            .select('*')
            .in('id', otherUserIds);

        // Map profiles to the friends list
        const friends = friendsData.map((friend: any) => {
            const otherUserId = friend.user_id === user.id ? friend.friend_id : friend.user_id;
            return {
                ...friend,
                friend_profile: profiles?.find(p => p.id === otherUserId),
            };
        });

        return friends as Friend[];
    },

    // Get pending friend requests
    getPendingRequests: async () => {
        const user = await authService.getUser();
        if (!user) throw new Error('Not authenticated');

        // Get pending requests
        const { data: requestsData, error } = await supabase
            .from('friends')
            .select('*')
            .eq('friend_id', user.id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) throw error;
        if (!requestsData || requestsData.length === 0) return [];

        // Get requester profiles separately
        const userIds = requestsData.map((r: any) => r.user_id);
        const { data: profiles } = await supabase
            .from('profiles')
            .select('*')
            .in('id', userIds);

        // Manually join the data
        const requests = requestsData.map((request: any) => ({
            ...request,
            friend_profile: profiles?.find(p => p.id === request.user_id),
        }));

        return requests as Friend[];
    },

    // Send friend request by username
    addFriend: async (username: string) => {
        const user = await authService.getUser();
        if (!user) throw new Error('Not authenticated');

        // Find user by username
        const { data: friendProfile, error: profileError } = await supabase
            .from('profiles')
            .select('id')
            .eq('username', username)
            .single();

        if (profileError || !friendProfile) {
            throw new Error('User not found');
        }

        if (friendProfile.id === user.id) {
            throw new Error('Cannot add yourself as friend');
        }

        // Create friend request
        const { data, error } = await supabase
            .from('friends')
            .insert({
                user_id: user.id,
                friend_id: friendProfile.id,
                status: 'pending',
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // Accept friend request
    acceptFriend: async (friendshipId: string) => {
        const { data, error } = await supabase
            .from('friends')
            .update({ status: 'accepted', updated_at: new Date().toISOString() })
            .eq('id', friendshipId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // Remove friend or decline request
    removeFriend: async (friendshipId: string) => {
        const { error } = await supabase
            .from('friends')
            .delete()
            .eq('id', friendshipId);

        if (error) throw error;
    },

    // Search users by username
    searchUsers: async (query: string) => {
        const user = await authService.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data: users, error } = await supabase
            .from('profiles')
            .select('id, username, avatar_url, email')
            .ilike('username', `%${query}%`)
            .neq('id', user.id)
            .limit(10);

        if (error) throw error;
        return users;
    },
};

// Messages service functions
export const messagesService = {
    // Get all conversations (grouped by user)
    getConversations: async () => {
        const user = await authService.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data: messages, error } = await supabase
            .from('messages')
            .select('*')
            .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
            .order('created_at', { ascending: false });

        if (error) throw error;
        if (!messages || messages.length === 0) return [];

        // Get all unique user IDs from messages
        const userIds = new Set<string>();
        messages.forEach((msg: any) => {
            userIds.add(msg.sender_id);
            userIds.add(msg.receiver_id);
        });

        // Fetch profiles for all users
        const { data: profiles } = await supabase
            .from('profiles')
            .select('*')
            .in('id', Array.from(userIds));

        // Attach profiles to messages
        const messagesWithProfiles = messages.map((msg: any) => ({
            ...msg,
            sender_profile: profiles?.find(p => p.id === msg.sender_id),
            receiver_profile: profiles?.find(p => p.id === msg.receiver_id),
        }));

        // Group by conversation partner
        const conversations = new Map<string, Message[]>();
        messagesWithProfiles?.forEach((msg: Message) => {
            const partnerId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
            if (!conversations.has(partnerId)) {
                conversations.set(partnerId, []);
            }
            conversations.get(partnerId)?.push(msg);
        });

        return Array.from(conversations.entries()).map(([partnerId, msgs]) => ({
            partnerId,
            messages: msgs,
            lastMessage: msgs[0],
            unreadCount: msgs.filter(m => !m.read && m.receiver_id === user.id).length,
        }));
    },

    // Get messages with specific user
    getMessages: async (userId: string) => {
        const user = await authService.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data: messages, error } = await supabase
            .from('messages')
            .select('*')
            .or(`and(sender_id.eq.${user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user.id})`)
            .order('created_at', { ascending: true });

        if (error) throw error;
        if (!messages || messages.length === 0) return [];

        // Get profiles
        const { data: profiles } = await supabase
            .from('profiles')
            .select('*')
            .in('id', [user.id, userId]);

        // Attach profiles to messages
        const messagesWithProfiles = messages.map((msg: any) => ({
            ...msg,
            sender_profile: profiles?.find(p => p.id === msg.sender_id),
            receiver_profile: profiles?.find(p => p.id === msg.receiver_id),
        }));

        return messagesWithProfiles as Message[];
    },

    // Send message
    sendMessage: async (receiverId: string, content: string, messageType: string = 'text') => {
        const user = await authService.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data, error } = await supabase
            .from('messages')
            .insert({
                sender_id: user.id,
                receiver_id: receiverId,
                content,
                message_type: messageType,
                read: false,
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // Mark messages as read
    markAsRead: async (messageIds: string[]) => {
        const { error } = await supabase
            .from('messages')
            .update({ read: true })
            .in('id', messageIds);

        if (error) throw error;
    },

    // Subscribe to new messages
    subscribeToMessages: (userId: string, callback: (message: Message) => void) => {
        const user = authService.getUser();

        return supabase
            .channel('messages')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `receiver_id=eq.${userId}`,
            }, (payload) => {
                callback(payload.new as Message);
            })
            .subscribe();
    },
};

export default supabase;
