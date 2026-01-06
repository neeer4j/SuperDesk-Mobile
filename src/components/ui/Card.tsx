import React, { memo, useMemo } from 'react';
import { View, StyleSheet, ViewStyle, TouchableOpacity, StyleProp } from 'react-native';
import { layout, shadows } from '../../theme/designSystem';
import { useTheme } from '../../context/ThemeContext';

interface CardProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    variant?: 'default' | 'outlined' | 'elevated';
    onPress?: () => void;
    padding?: keyof typeof layout.spacing;
}

const CardComponent: React.FC<CardProps> = ({
    children,
    style,
    variant = 'default',
    onPress,
    padding = 'md',
}) => {
    const { colors } = useTheme();

    const cardStyles = useMemo(() => {
        const baseStyle = {
            padding: layout.spacing[padding],
            borderRadius: layout.borderRadius.lg,
        };

        let variantStyle;
        switch (variant) {
            case 'outlined':
                variantStyle = {
                    ...baseStyle,
                    backgroundColor: 'transparent',
                    borderWidth: 1,
                    borderColor: colors.border,
                };
                break;
            case 'elevated':
                variantStyle = {
                    ...baseStyle,
                    backgroundColor: colors.card,
                    borderWidth: 0,
                    ...shadows.md,
                };
                break;
            default:
                variantStyle = {
                    ...baseStyle,
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.border,
                };
        }

        return [variantStyle, style];
    }, [variant, padding, colors, style]);

    if (onPress) {
        return (
            <TouchableOpacity style={cardStyles} onPress={onPress} activeOpacity={0.7}>
                {children}
            </TouchableOpacity>
        );
    }

    return <View style={cardStyles}>{children}</View>;
};

// Memoize the component to prevent unnecessary re-renders
export const Card = memo(CardComponent);

const styles = StyleSheet.create({});
