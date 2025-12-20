import React from 'react';
import { View, StyleSheet, ViewStyle, TouchableOpacity } from 'react-native';
import { layout, shadows } from '../../theme/designSystem';
import { useTheme } from '../../context/ThemeContext';

interface CardProps {
    children: React.ReactNode;
    style?: ViewStyle;
    variant?: 'default' | 'outlined' | 'elevated';
    onPress?: () => void;
    padding?: keyof typeof layout.spacing;
}

export const Card: React.FC<CardProps> = ({
    children,
    style,
    variant = 'default',
    onPress,
    padding = 'md',
}) => {
    const { colors } = useTheme();

    const getCardStyles = () => {
        const baseStyle = {
            padding: layout.spacing[padding],
            borderRadius: layout.borderRadius.md,
        };

        switch (variant) {
            case 'outlined':
                return {
                    ...baseStyle,
                    backgroundColor: 'transparent',
                    borderWidth: 1,
                    borderColor: colors.border,
                };
            case 'elevated':
                return {
                    ...baseStyle,
                    backgroundColor: colors.card,
                    borderWidth: 0,
                    ...shadows.md,
                };
            default:
                return {
                    ...baseStyle,
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.border,
                };
        }
    };

    const cardStyles = [getCardStyles(), style];

    if (onPress) {
        return (
            <TouchableOpacity style={cardStyles} onPress={onPress} activeOpacity={0.7}>
                {children}
            </TouchableOpacity>
        );
    }

    return <View style={cardStyles}>{children}</View>;
};

const styles = StyleSheet.create({});
