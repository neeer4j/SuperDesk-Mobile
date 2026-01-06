import React, { memo, useMemo } from 'react';
import {
    TouchableOpacity,
    Text,
    StyleSheet,
    ActivityIndicator,
    ViewStyle,
    TextStyle,
} from 'react-native';
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

    return (
        <TouchableOpacity
            style={buttonStyle}
            onPress={onPress}
            activeOpacity={0.7}
            disabled={disabled || loading}>
            {loading ? (
                <ActivityIndicator color={textColor} />
            ) : (
                <>
                    {icon && <>{icon}</>}
                    <Text style={labelStyle}>{title}</Text>
                </>
            )}
        </TouchableOpacity>
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
