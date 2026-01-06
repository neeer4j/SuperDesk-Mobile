import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    Easing,
    interpolate,
} from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';

interface SkeletonProps {
    width?: number | string;
    height?: number;
    borderRadius?: number;
    style?: ViewStyle;
}

export const Skeleton: React.FC<SkeletonProps> = ({
    width = '100%',
    height = 20,
    borderRadius = 8,
    style,
}) => {
    const { colors } = useTheme();
    const shimmer = useSharedValue(0);

    useEffect(() => {
        shimmer.value = withRepeat(
            withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
            -1,
            true
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: interpolate(shimmer.value, [0, 1], [0.3, 0.7]),
    }));

    return (
        <Animated.View
            style={[
                styles.skeleton,
                {
                    width: width as any,
                    height,
                    borderRadius,
                    backgroundColor: colors.border,
                },
                animatedStyle,
                style,
            ]}
        />
    );
};

// Pre-built skeleton layouts
export const SkeletonListItem: React.FC<{ style?: ViewStyle }> = ({ style }) => {
    const { colors } = useTheme();
    return (
        <View style={[styles.listItem, { backgroundColor: colors.surface }, style]}>
            <Skeleton width={48} height={48} borderRadius={24} />
            <View style={styles.listItemContent}>
                <Skeleton width="60%" height={16} style={{ marginBottom: 8 }} />
                <Skeleton width="80%" height={12} />
            </View>
        </View>
    );
};

export const SkeletonCard: React.FC<{ style?: ViewStyle }> = ({ style }) => {
    const { colors } = useTheme();
    return (
        <View style={[styles.card, { backgroundColor: colors.surface }, style]}>
            <Skeleton width="40%" height={20} style={{ marginBottom: 12 }} />
            <Skeleton width="100%" height={14} style={{ marginBottom: 8 }} />
            <Skeleton width="70%" height={14} />
        </View>
    );
};

const styles = StyleSheet.create({
    skeleton: {
        overflow: 'hidden',
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
    },
    listItemContent: {
        flex: 1,
        marginLeft: 12,
    },
    card: {
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
    },
});
