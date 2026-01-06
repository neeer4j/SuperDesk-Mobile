// Left Sliding Drawer - Complete Settings Panel with Gestures

import { Logger } from '../utils/Logger';
// Left Sliding Drawer - Complete Settings Panel with Gestures
import React, { useRef, useEffect, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Animated,
    Dimensions,
    Image,
    ScrollView,
    Switch,
    Alert,
    TextInput,
    Modal,
    PanResponder,
} from 'react-native';
import { useTheme, accentColors, AccentColorKey } from '../context/ThemeContext';
import { authService } from '../services/supabaseClient';
import { biometricService, BiometryType } from '../services/BiometricService';
import { hapticService } from '../services/HapticService';

const DRAWER_WIDTH = Dimensions.get('window').width * 0.85;
const SWIPE_THRESHOLD = 50;

interface SideDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    onOpen: () => void;
    navigation: any;
    userProfile?: {
        username: string;
        email: string | null;
        avatar_url: string | null;
    } | null;
}

const SideDrawer: React.FC<SideDrawerProps> = ({ isOpen, onClose, onOpen, navigation, userProfile: initialProfile }) => {
    const { theme, colors, toggleTheme, accentColor, setAccentColor } = useTheme();
    const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
    const overlayOpacity = useRef(new Animated.Value(0)).current;

    const [userProfile, setUserProfile] = useState(initialProfile);
    // Preference toggles for notifications/audio were removed because they were not wired
    // into any behavior. Add back with real side effects before exposing in UI.
    const [videoQuality, setVideoQuality] = useState('Auto');
    const [showEditProfile, setShowEditProfile] = useState(false);
    const [editUsername, setEditUsername] = useState('');
    const [biometryType, setBiometryType] = useState<BiometryType | null>(null);
    const [biometricsEnabled, setBiometricsEnabled] = useState(false);
    const [biometricTimeout, setBiometricTimeout] = useState(0);

    useEffect(() => {
        setUserProfile(initialProfile);
        if (initialProfile?.username) {
            setEditUsername(initialProfile.username);
        }
    }, [initialProfile]);

    // Load biometric settings
    useEffect(() => {
        const loadBiometrics = async () => {
            try {
                const type = await biometricService.checkAvailability();
                Logger.debug('📱 SideDrawer: Biometry type:', type);
                setBiometryType(type);
                if (type) {
                    const enabled = await biometricService.isEnabled();
                    const timeout = await biometricService.getTimeout();
                    setBiometricsEnabled(enabled);
                    setBiometricTimeout(timeout);
                }
            } catch (error) {
                Logger.debug('📱 SideDrawer: Biometric error:', error);
            }
        };
        loadBiometrics();
    }, []);

    const handleBiometricToggle = async () => {
        const newValue = !biometricsEnabled;
        setBiometricsEnabled(newValue);
        await biometricService.setEnabled(newValue);
    };

    const handleTimeoutChange = async (minutes: number) => {
        setBiometricTimeout(minutes);
        await biometricService.setTimeout(minutes);
    };

    useEffect(() => {
        Animated.parallel([
            Animated.spring(slideAnim, {
                toValue: isOpen ? 0 : -DRAWER_WIDTH,
                useNativeDriver: true,
                damping: 25,
                stiffness: 180,
                mass: 1,
                overshootClamping: false,
                restDisplacementThreshold: 0.01,
                restSpeedThreshold: 0.01,
            }),
            Animated.timing(overlayOpacity, {
                toValue: isOpen ? 1 : 0,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start();
    }, [isOpen]);

    // Pan Responder for swipe gestures
    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (evt, gestureState) => {
                const { dx, dy } = gestureState;
                // Detect swipe from left edge to open
                if (!isOpen && evt.nativeEvent.pageX < 20 && dx > 10) {
                    return true;
                }
                // Detect swipe to close when open
                if (isOpen && dx < -10) {
                    return true;
                }
                return false;
            },
            onPanResponderMove: (evt, gestureState) => {
                if (!isOpen && gestureState.dx > 0) {
                    // Opening gesture
                    const newValue = Math.min(0, -DRAWER_WIDTH + gestureState.dx);
                    slideAnim.setValue(newValue);
                    overlayOpacity.setValue(Math.min(1, gestureState.dx / DRAWER_WIDTH));
                } else if (isOpen && gestureState.dx < 0) {
                    // Closing gesture
                    const newValue = Math.max(-DRAWER_WIDTH, gestureState.dx);
                    slideAnim.setValue(newValue);
                    overlayOpacity.setValue(Math.max(0, 1 + (gestureState.dx / DRAWER_WIDTH)));
                }
            },
            onPanResponderRelease: (evt, gestureState) => {
                if (!isOpen && gestureState.dx > SWIPE_THRESHOLD) {
                    onOpen();
                } else if (isOpen && gestureState.dx < -SWIPE_THRESHOLD) {
                    onClose();
                } else {
                    // Snap back to current state with smooth spring
                    Animated.parallel([
                        Animated.spring(slideAnim, {
                            toValue: isOpen ? 0 : -DRAWER_WIDTH,
                            useNativeDriver: true,
                            damping: 25,
                            stiffness: 180,
                            mass: 1,
                        }),
                        Animated.timing(overlayOpacity, {
                            toValue: isOpen ? 1 : 0,
                            duration: 300,
                            useNativeDriver: true,
                        }),
                    ]).start();
                }
            },
        })
    ).current;

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
                            onClose();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to logout');
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
            Alert.alert('Error', 'Failed to update profile');
        }
    };

    const SettingToggle = ({ icon, title, subtitle, value, onToggle }: {
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

    const SettingDropdown = ({ icon, title, subtitle, value }: {
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
        <>
            {/* Overlay */}
            <Animated.View
                style={[
                    styles.overlay,
                    {
                        opacity: overlayOpacity,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                    },
                ]}
                pointerEvents={isOpen ? 'auto' : 'none'}
            >
                <TouchableOpacity
                    style={styles.overlayTouch}
                    activeOpacity={1}
                    onPress={onClose}
                />
            </Animated.View>

            {/* Drawer */}
            <Animated.View
                {...panResponder.panHandlers}
                style={[
                    styles.drawer,
                    {
                        backgroundColor: colors.background,
                        transform: [{ translateX: slideAnim }],
                        borderRightColor: colors.border,
                    },
                ]}
            >
                <ScrollView showsVerticalScrollIndicator={false}>
                    {/* Account Section */}
                    <Text style={[styles.sectionTitle, { color: colors.primary }]}>ACCOUNT</Text>
                    <TouchableOpacity
                        style={[styles.accountCard, {
                            backgroundColor: colors.card,
                            borderColor: colors.cardBorder,
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

                    {/* Appearance Section */}
                    <Text style={[styles.sectionTitle, { color: colors.primary }]}>APPEARANCE</Text>
                    <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                        <SettingToggle
                            icon="🌙"
                            title="Dark Mode"
                            subtitle="Switch to dark theme"
                            value={theme === 'dark'}
                            onToggle={() => {
                                hapticService.selection();
                                toggleTheme();
                            }}
                        />
                    </View>

                    {/* Theme Colors Section */}
                    <Text style={[styles.sectionTitle, { color: colors.primary }]}>THEME COLOR</Text>
                    <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                        <View style={styles.colorPickerContainer}>
                            {(Object.keys(accentColors) as AccentColorKey[]).map((key) => {
                                const color = accentColors[key];
                                const isSelected = accentColor === key;
                                return (
                                    <TouchableOpacity
                                        key={key}
                                        style={[
                                            styles.colorOption,
                                            { backgroundColor: color.primary },
                                            isSelected && styles.colorOptionSelected,
                                            isSelected && { borderColor: colors.text },
                                        ]}
                                        onPress={() => {
                                            hapticService.selection();
                                            setAccentColor(key);
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        {isSelected && (
                                            <Text style={styles.colorCheckmark}>✓</Text>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                        <Text style={[styles.colorPickerLabel, { color: colors.subText }]}>
                            {accentColors[accentColor].name}
                        </Text>
                    </View>

                    {/* Security Section */}
                    <Text style={[styles.sectionTitle, { color: colors.primary }]}>SECURITY</Text>
                    <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                        {biometryType ? (
                            <SettingToggle
                                icon="🔐"
                                title={`${biometricService.getBiometryName(biometryType)} Login`}
                                subtitle="Use biometrics for secure login"
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

                    {/* Connection Section */}
                    <Text style={[styles.sectionTitle, { color: colors.primary }]}>CONNECTION</Text>
                    <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                        <SettingDropdown
                            icon="📺"
                            title="Video Quality"
                            subtitle="Adjust stream quality"
                            value={videoQuality}
                        />
                    </View>

                    {/* Logout Button */}
                    <TouchableOpacity
                        style={[styles.logoutButton, {
                            borderColor: colors.error + '40',
                            backgroundColor: colors.error + '20'
                        }]}
                        onPress={handleLogout}
                    >
                        <Text style={[styles.logoutText, { color: colors.error }]}>Logout</Text>
                    </TouchableOpacity>

                    {/* Footer */}
                    <View style={styles.footer}>
                        <Text style={[styles.footerText, { color: colors.subText }]}>
                            SuperDesk Mobile v1.3.0
                        </Text>
                    </View>
                </ScrollView>
            </Animated.View>

            {/* Edit Profile Modal */}
            <Modal
                transparent
                visible={showEditProfile}
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

                        <Text style={[styles.inputLabel, { color: colors.subText }]}>Username</Text>
                        <TextInput
                            style={[styles.input, {
                                backgroundColor: colors.background,
                                borderColor: colors.border,
                                color: colors.text
                            }]}
                            value={editUsername}
                            onChangeText={setEditUsername}
                            placeholder="Enter username"
                            placeholderTextColor={colors.subText}
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalButton, { backgroundColor: colors.border }]}
                                onPress={() => setShowEditProfile(false)}
                            >
                                <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, { backgroundColor: colors.primary }]}
                                onPress={handleSaveProfile}
                            >
                                <Text style={[styles.modalButtonText, { color: '#FFF' }]}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 998,
    },
    overlayTouch: {
        flex: 1,
    },
    drawer: {
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        width: DRAWER_WIDTH,
        zIndex: 999,
        borderRightWidth: 1,
        paddingTop: 20,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1,
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: 8,
    },
    accountCard: {
        borderRadius: 20,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 16,
        marginBottom: 8,
    },
    accountAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        marginRight: 12,
    },
    accountAvatarPlaceholder: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    accountAvatarText: {
        fontSize: 20,
        fontWeight: '600',
    },
    accountInfo: {
        flex: 1,
    },
    accountEmail: {
        fontSize: 14,
        fontWeight: '500',
        marginBottom: 2,
    },
    accountUsername: {
        fontSize: 12,
        color: '#888',
    },
    chevron: {
        fontSize: 24,
    },
    section: {
        borderRadius: 20,
        overflow: 'hidden',
        marginHorizontal: 16,
        marginBottom: 8,
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
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
        fontSize: 15,
        fontWeight: '500',
        marginBottom: 2,
    },
    settingSubtitle: {
        fontSize: 12,
    },
    colorPickerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
    },
    colorOption: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: 'transparent',
    },
    colorOptionSelected: {
        borderWidth: 3,
    },
    colorCheckmark: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    colorPickerLabel: {
        textAlign: 'center',
        fontSize: 12,
        paddingBottom: 12,
        marginTop: 4,
    },
    dropdown: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    dropdownText: {
        fontSize: 14,
        marginRight: 4,
    },
    dropdownArrow: {
        fontSize: 12,
        color: '#888',
    },
    logoutButton: {
        borderRadius: 20,
        padding: 16,
        alignItems: 'center',
        marginTop: 24,
        marginHorizontal: 16,
    },
    logoutText: {
        fontSize: 16,
        fontWeight: '600',
    },
    footer: {
        paddingVertical: 32,
        alignItems: 'center',
    },
    footerText: {
        fontSize: 12,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        padding: 20,
    },
    modalContent: {
        borderRadius: 24,
        padding: 24,
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
        fontSize: 28,
    },
    modalAvatarContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    modalAvatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        marginBottom: 12,
    },
    modalAvatarPlaceholder: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    modalAvatarText: {
        fontSize: 32,
        fontWeight: '600',
    },
    changePhotoButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    changePhotoText: {
        fontSize: 14,
    },
    inputLabel: {
        fontSize: 13,
        marginBottom: 8,
        fontWeight: '500',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    input: {
        borderRadius: 12,
        padding: 14,
        fontSize: 16,
        marginBottom: 24,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    modalButton: {
        flex: 1,
        padding: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    modalButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
});

export default SideDrawer;
