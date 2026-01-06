import React, { memo, useMemo, useCallback } from 'react';
import { View, StyleSheet, ViewStyle, StyleProp, Pressable } from 'react-native';
import Animated, { 
    useSharedValue, 
    useAnimatedStyle, 
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { layout, shadows } from '../../theme/designSystem';
import { useTheme } from '../../context/ThemeContext';

interface CardProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    variant?: 'default' | 'outlined' | 'elevated';
    onPress?: () => void;
    padding?: keyof typeof layout.spacing;
    animated?: boolean; // Enable press animations
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const CardComponent: React.FC<CardProps> = ({
    children,
    style,
    variant = 'default',
    onPress,
    padding = 'md',
    animated = true,
}) => {
    const { colors } = useTheme();
    const scale = useSharedValue(1);
    const opacity = useSharedValue(1);

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
                // Default: glass/translucent surface
                variantStyle = {
                    ...baseStyle,
                    backgroundColor: colors.cardGlass,
                    borderWidth: 1,
                    borderColor: colors.glassBorder,
                };
        }

        return [variantStyle, style];
    }, [variant, padding, colors, style]);

    const animatedCardStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    const handlePressIn = useCallback(() => {
        if (animated && onPress) {
            scale.value = withSpring(0.98, { damping: 15, stiffness: 400 });
            opacity.value = withTiming(0.9, { duration: 100 });
        }
    }, [animated, onPress]);

    const handlePressOut = useCallback(() => {
        if (animated && onPress) {
            scale.value = withSpring(1, { damping: 15, stiffness: 400 });
            opacity.value = withTiming(1, { duration: 100 });
        }
    }, [animated, onPress]);

    if (onPress) {
        return (
            <AnimatedPressable 
                style={[cardStyles, animatedCardStyle]} 
                onPress={onPress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
            >
                {children}
            </AnimatedPressable>
        );
    }

    return <View style={cardStyles}>{children}</View>;
};

// Memoize the component to prevent unnecessary re-renders
export const Card = memo(CardComponent);

const styles = StyleSheet.create({});
