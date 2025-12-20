import React from 'react';
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

export const Button: React.FC<ButtonProps> = ({
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

    const getBackgroundColor = () => {
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
    };

    const getTextColor = () => {
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
    };

    const getHeight = () => {
        switch (size) {
            case 'sm':
                return 36;
            case 'lg':
                return 56;
            default:
                return 48;
        }
    };

    const getFontSize = () => {
        switch (size) {
            case 'sm':
                return typography.size.sm;
            case 'lg':
                return typography.size.lg;
            default:
                return typography.size.md;
        }
    };

    return (
        <TouchableOpacity
            style={[
                styles.button,
                {
                    backgroundColor: getBackgroundColor(),
                    height: getHeight(),
                    paddingHorizontal: size === 'sm' ? layout.spacing.md : layout.spacing.lg,
                },
                variant === 'ghost' && { borderWidth: 0 },
                style,
            ]}
            onPress={onPress}
            activeOpacity={0.7}
            disabled={disabled || loading}
        >
            {loading ? (
                <ActivityIndicator color={getTextColor()} />
            ) : (
                <>
                    {icon && <>{icon}</>}
                    <Text
                        style={[
                            styles.text,
                            {
                                color: getTextColor(),
                                fontSize: getFontSize(),
                                marginLeft: icon ? layout.spacing.sm : 0,
                            },
                            textStyle,
                        ]}
                    >
                        {title}
                    </Text>
                </>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: layout.borderRadius.md,
    },
    text: {
        fontFamily: typography.fontFamily.medium,
        fontWeight: '600',
    },
});
