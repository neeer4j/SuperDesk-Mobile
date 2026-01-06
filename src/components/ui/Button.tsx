import React, { memo, useMemo, useCallback } from 'react';
import {
    Pressable,
    Text,
    StyleSheet,
    ActivityIndicator,
    ViewStyle,
    TextStyle,
} from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { layout, typography } from '../../theme/designSystem';
import { useTheme } from '../../context/ThemeContext';

interface ButtonProps {
    title: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    disabled?: boolean;
    style?: ViewStyle;
    textStyle?: TextStyle;
    icon?: React.ReactNode;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const ButtonComponent: React.FC<ButtonProps> = ({
    title,
    onPress,
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    style,
    textStyle,
    icon,
}) => {
    const { colors } = useTheme();
    const scale = useSharedValue(1);

    const backgroundColor = useMemo(() => {
        if (disabled) return colors.border;
        switch (variant) {
            case 'primary':
                return colors.primary;
            case 'secondary':
                return colors.border;
            case 'danger':
                return colors.error;
            case 'ghost':
                return 'transparent';
            default:
                return colors.primary;
        }
    }, [disabled, variant, colors]);

    const textColor = useMemo(() => {
        if (disabled) return colors.subText;
        switch (variant) {
            case 'primary':
            case 'danger':
                return '#ffffff';
            case 'secondary':
                return colors.text;
            case 'ghost':
                return colors.primary;
            default:
                return '#ffffff';
        }
    }, [disabled, variant, colors]);

    const height = useMemo(() => {
        switch (size) {
            case 'sm':
                return 36;
            case 'lg':
                return 56;
            default:
                return 48;
        }
    }, [size]);

    const fontSize = useMemo(() => {
        switch (size) {
            case 'sm':
                return typography.size.sm;
            case 'lg':
                return typography.size.lg;
            default:
                return typography.size.md;
        }
    }, [size]);

    const buttonStyle = useMemo(
        () => [
            styles.button,
            {
                backgroundColor,
                height,
                paddingHorizontal: size === 'sm' ? layout.spacing.md : layout.spacing.lg,
            },
            variant === 'ghost' && { borderWidth: 0 },
            style,
        ],
        [backgroundColor, height, size, variant, style],
    );

    const labelStyle = useMemo(
        () => [
            styles.text,
            {
                color: textColor,
                fontSize,
                marginLeft: icon ? layout.spacing.sm : 0,
            },
            textStyle,
        ],
        [textColor, fontSize, icon, textStyle],
    );

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const handlePressIn = useCallback(() => {
        scale.value = withSpring(0.95, { damping: 15, stiffness: 400 });
    }, []);

    const handlePressOut = useCallback(() => {
        scale.value = withSpring(1, { damping: 15, stiffness: 400 });
    }, []);

    return (
        <AnimatedPressable
            style={[buttonStyle, animatedStyle]}
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={disabled || loading}>
            {loading ? (
                <ActivityIndicator color={textColor} />
            ) : (
                <>
                    {icon && <>{icon}</>}
                    <Text style={labelStyle}>{title}</Text>
                </>
            )}
        </AnimatedPressable>
    );
};

// Memoize the component to prevent unnecessary re-renders
export const Button = memo(ButtonComponent);

const styles = StyleSheet.create({
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: layout.borderRadius.lg,
    },
    text: {
        fontFamily: typography.fontFamily.medium,
        fontWeight: '600',
    },
});
