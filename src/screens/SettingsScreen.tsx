// Settings Screen - Matching Desktop Design

import { Logger } from '../utils/Logger';
// Settings Screen - Matching Desktop Design
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    StatusBar,
    ScrollView,
    Switch,
    Alert,
    Image,
    Modal,
    TextInput,
} from 'react-native';
import { BackIcon } from '../components/Icons';
import { authService } from '../services/supabaseClient';
import { biometricService, BiometryType } from '../services/BiometricService';
import { useTheme } from '../context/ThemeContext';

interface SettingsScreenProps {
    navigation: any;
    onLogout?: () => void;
}

interface UserProfile {
    username: string;
    email: string | null;
    avatar_url: string | null;
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation, onLogout }) => {
    const { theme, colors, toggleTheme } = useTheme();
    // Preference toggles for notifications/audio were removed because they were not wired
    // into any behavior. Add back with real side effects before exposing in UI.
    const [videoQuality, setVideoQuality] = useState('Auto');
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [showEditProfile, setShowEditProfile] = useState(false);
    const [editUsername, setEditUsername] = useState('');
    const [biometryType, setBiometryType] = useState<BiometryType | null>(null);
    const [biometricsEnabled, setBiometricsEnabled] = useState(false);

    useEffect(() => {
        loadUserProfile();
        loadBiometricSettings();
    }, []);

    const loadBiometricSettings = async () => {
        try {
            Logger.debug('📱 SettingsScreen: Checking biometric availability...');
            const type = await biometricService.checkAvailability();
            Logger.debug('📱 SettingsScreen: Biometry type:', type);
            setBiometryType(type);
            if (type) {
                const enabled = await biometricService.isEnabled();
                Logger.debug('📱 SettingsScreen: Biometrics enabled:', enabled);
                setBiometricsEnabled(enabled);
            }
        } catch (error) {
            Logger.debug('📱 SettingsScreen: Biometric check error:', error);
        }
    };

    const handleBiometricToggle = async () => {
        const newValue = !biometricsEnabled;
        setBiometricsEnabled(newValue);
        await biometricService.setEnabled(newValue);
        if (newValue) {
            Alert.alert('Biometrics Enabled', 'You can now use your fingerprint or face to log in.');
        }
    };

    const loadUserProfile = async () => {
        try {
            const profile = await authService.getUserProfile();
            if (profile) {
                setUserProfile({
                    username: profile.username,
                    email: profile.email,
                    avatar_url: profile.avatar_url,
                });
                setEditUsername(profile.username);
            }
        } catch (error) {
            // Ignore errors
        }
    };

    const handleLogout = () => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await authService.signOut();
                            if (onLogout) {
                                onLogout();
                            }
                        } catch (error) {
                            Alert.alert('Error', 'Failed to logout. Please try again.');
                        }
                    }
                },
            ]
        );
    };

    const handleSaveProfile = async () => {
        try {
            await authService.updateProfile({ username: editUsername });
            setUserProfile(prev => prev ? { ...prev, username: editUsername } : null);
            setShowEditProfile(false);
            Alert.alert('Success', 'Profile updated successfully');
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to update profile');
        }
    };

    const SettingToggle = ({
        icon,
        title,
        subtitle,
        value,
        onToggle
    }: {
        icon: string;
        title: string;
        subtitle: string;
        value: boolean;
        onToggle: () => void;
    }) => (
        <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
            <View style={[styles.settingIcon, { backgroundColor: colors.iconBackground }]}>
                <Text style={styles.iconText}>{icon}</Text>
            </View>
            <View style={styles.settingInfo}>
                <Text style={[styles.settingTitle, { color: colors.text }]}>{title}</Text>
                <Text style={[styles.settingSubtitle, { color: colors.subText }]}>{subtitle}</Text>
            </View>
            <Switch
                value={value}
                onValueChange={onToggle}
                trackColor={{ false: '#333', true: colors.success }}
                thumbColor={'#fff'}
            />
        </View>
    );

    const SettingDropdown = ({
        icon,
        title,
        subtitle,
        value,
    }: {
        icon: string;
        title: string;
        subtitle: string;
        value: string;
    }) => (
        <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
            <View style={[styles.settingIcon, { backgroundColor: colors.iconBackground }]}>
                <Text style={styles.iconText}>{icon}</Text>
            </View>
            <View style={styles.settingInfo}>
                <Text style={[styles.settingTitle, { color: colors.text }]}>{title}</Text>
                <Text style={[styles.settingSubtitle, { color: colors.subText }]}>{subtitle}</Text>
            </View>
            <View style={[styles.dropdown, { backgroundColor: colors.border }]}>
                <Text style={[styles.dropdownText, { color: colors.text }]}>{value}</Text>
                <Text style={styles.dropdownArrow}>▾</Text>
            </View>
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar
                barStyle={theme === 'dark' ? 'light-content' : 'dark-content'}
                backgroundColor={colors.background}
            />

            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <BackIcon size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
                <View style={styles.headerRight} />
            </View>

            <ScrollView style={styles.scrollView}>
                <Text style={[styles.sectionTitle, { color: colors.primary }]}>ACCOUNT</Text>
                <TouchableOpacity
                    style={[styles.accountCard, {
                        backgroundColor: colors.card,
                        borderColor: colors.cardBorder
                    }]}
                    onPress={() => setShowEditProfile(true)}
                >
                    {userProfile?.avatar_url ? (
                        <Image
                            source={{ uri: userProfile.avatar_url }}
                            style={styles.accountAvatar}
                        />
                    ) : (
                        <View style={[styles.accountAvatarPlaceholder, { backgroundColor: colors.border }]}>
                            <Text style={[styles.accountAvatarText, { color: colors.text }]}>
                                {userProfile?.username?.charAt(0).toUpperCase() || '?'}
                            </Text>
                        </View>
                    )}
                    <View style={styles.accountInfo}>
                        <Text style={[styles.accountEmail, { color: colors.text }]}>{userProfile?.email}</Text>
                        <Text style={styles.accountUsername}>@{userProfile?.username}</Text>
                    </View>
                    <Text style={[styles.chevron, { color: colors.subText }]}>›</Text>
                </TouchableOpacity>

                <Text style={[styles.sectionTitle, { color: colors.primary }]}>APPEARANCE</Text>
                <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                    <SettingToggle
                        icon="🌙"
                        title="Dark Mode"
                        subtitle="Switch to dark theme"
                        value={theme === 'dark'}
                        onToggle={toggleTheme}
                    />
                </View>

                {/* Security Section - Always visible */}
                <Text style={[styles.sectionTitle, { color: colors.primary }]}>SECURITY</Text>
                <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                    {biometryType ? (
                        <SettingToggle
                            icon="🔐"
                            title={`${biometricService.getBiometryName(biometryType)} Login`}
                            subtitle="Use biometrics for faster login"
                            value={biometricsEnabled}
                            onToggle={handleBiometricToggle}
                        />
                    ) : (
                        <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
                            <View style={[styles.settingIcon, { backgroundColor: colors.iconBackground }]}>
                                <Text style={styles.iconText}>🔐</Text>
                            </View>
                            <View style={styles.settingInfo}>
                                <Text style={[styles.settingTitle, { color: colors.subText }]}>Biometric Login</Text>
                                <Text style={[styles.settingSubtitle, { color: colors.subText }]}>Not available on this device</Text>
                            </View>
                        </View>
                    )}
                </View>

                <Text style={[styles.sectionTitle, { color: colors.primary }]}>CONNECTION</Text>
                <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                    <SettingDropdown
                        icon="📺"
                        title="Video Quality"
                        subtitle="Adjust stream quality"
                        value={videoQuality}
                    />
                </View>

                <TouchableOpacity
                    style={[styles.logoutButton, { borderColor: colors.error + '40', backgroundColor: colors.error + '20' }]}
                    onPress={handleLogout}
                >
                    <Text style={[styles.logoutText, { color: colors.error }]}>Logout</Text>
                </TouchableOpacity>

                <View style={styles.footer}>
                    <Text style={[styles.footerText, { color: colors.subText }]}>SuperDesk Mobile v1.0.0</Text>
                </View>
            </ScrollView>

            <Modal
                visible={showEditProfile}
                transparent
                animationType="fade"
                onRequestClose={() => setShowEditProfile(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Profile</Text>
                            <TouchableOpacity onPress={() => setShowEditProfile(false)}>
                                <Text style={[styles.modalClose, { color: colors.subText }]}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalAvatarContainer}>
                            {userProfile?.avatar_url ? (
                                <Image
                                    source={{ uri: userProfile.avatar_url }}
                                    style={styles.modalAvatar}
                                />
                            ) : (
                                <View style={[styles.modalAvatarPlaceholder, { backgroundColor: colors.border }]}>
                                    <Text style={[styles.modalAvatarText, { color: colors.text }]}>
                                        {userProfile?.username?.charAt(0).toUpperCase() || '?'}
                                    </Text>
                                </View>
                            )}
                            <TouchableOpacity style={[styles.changePhotoButton, { backgroundColor: colors.border }]}>
                                <Text style={[styles.changePhotoText, { color: colors.text }]}>📷 Change Photo</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalField}>
                            <Text style={[styles.modalLabel]}>EMAIL</Text>
                            <View style={[styles.modalInputDisabled, { backgroundColor: colors.border }]}>
                                <Text style={[styles.modalInputText, { color: colors.subText }]}>{userProfile?.email}</Text>
                            </View>
                            <Text style={[styles.modalHint, { color: colors.subText }]}>Your email cannot be changed</Text>
                        </View>

                        <View style={styles.modalField}>
                            <Text style={[styles.modalLabel]}>USERNAME</Text>
                            <TextInput
                                style={[styles.modalInput, { backgroundColor: colors.border, color: colors.text }]}
                                value={editUsername}
                                onChangeText={setEditUsername}
                                placeholder="@username"
                                placeholderTextColor={colors.subText}
                            />
                            <Text style={[styles.modalHint, { color: colors.subText }]}>Letters, numbers, underscores and periods. 3-30 characters.</Text>
                        </View>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalCancelButton, { backgroundColor: colors.border }]}
                                onPress={() => setShowEditProfile(false)}
                            >
                                <Text style={[styles.modalCancelText, { color: colors.text }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalSaveButton, { backgroundColor: colors.primary }]}
                                onPress={handleSaveProfile}
                            >
                                <Text style={[styles.modalSaveText, { color: '#ffffff' }]}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 12,
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '600',
    },
    headerRight: {
        width: 40,
    },
    scrollView: {
        flex: 1,
        paddingHorizontal: 20,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '600',
        marginTop: 24,
        marginBottom: 12,
        letterSpacing: 1,
    },
    accountCard: {
        borderRadius: 20,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
    },
    accountAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    accountAvatarPlaceholder: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    accountAvatarText: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    accountInfo: {
        marginLeft: 12,
        flex: 1,
    },
    accountEmail: {
        fontSize: 16,
        fontWeight: '600',
    },
    accountUsername: {
        fontSize: 14,
        color: '#888',
        marginTop: 2,
    },
    chevron: {
        fontSize: 24,
    },
    section: {
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
    },
    settingIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    iconText: {
        fontSize: 20,
    },
    settingInfo: {
        flex: 1,
    },
    settingTitle: {
        fontSize: 16,
        fontWeight: '500',
    },
    settingSubtitle: {
        fontSize: 13,
        marginTop: 2,
    },
    dropdown: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
    },
    dropdownText: {
        marginRight: 8,
    },
    dropdownArrow: {
        color: '#666',
    },
    logoutButton: {
        borderRadius: 20,
        padding: 16,
        alignItems: 'center',
        marginTop: 24,
        borderWidth: 1,
    },
    logoutText: {
        fontSize: 16,
        fontWeight: '600',
    },
    footer: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    footerText: {
        fontSize: 14,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        borderRadius: 24,
        padding: 24,
        width: '100%',
        maxWidth: 400,
        borderWidth: 1,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '600',
    },
    modalClose: {
        fontSize: 20,
        padding: 8,
    },
    modalAvatarContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    modalAvatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
    },
    modalAvatarPlaceholder: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalAvatarText: {
        fontSize: 40,
        fontWeight: 'bold',
    },
    changePhotoButton: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        marginTop: 16,
    },
    changePhotoText: {
        fontSize: 14,
    },
    modalField: {
        marginBottom: 20,
    },
    modalLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#888',
        marginBottom: 8,
        letterSpacing: 1,
    },
    modalInputDisabled: {
        borderRadius: 8,
        padding: 14,
    },
    modalInputText: {
        fontSize: 16,
    },
    modalInput: {
        borderRadius: 12,
        padding: 14,
        fontSize: 16,
    },
    modalHint: {
        fontSize: 12,
        marginTop: 6,
    },
    modalButtons: {
        flexDirection: 'row',
        marginTop: 8,
    },
    modalCancelButton: {
        flex: 1,
        padding: 14,
        borderRadius: 8,
        alignItems: 'center',
        marginRight: 8,
    },
    modalCancelText: {
        fontWeight: '600',
    },
    modalSaveButton: {
        flex: 1,
        padding: 14,
        borderRadius: 8,
        alignItems: 'center',
        marginLeft: 8,
    },
    modalSaveText: {
        fontWeight: '600',
    },
});

export default SettingsScreen;
