import React, { useMemo, memo, useEffect } from 'react';
import { View, StyleSheet, StatusBar, SafeAreaView, ViewStyle, ScrollView } from 'react-native';
import Animated, { 
    useSharedValue, 
    useAnimatedStyle, 
    withTiming, 
    Easing,
    FadeIn,
} from 'react-native-reanimated';
import { layout } from '../../theme/designSystem';
import { useTheme } from '../../context/ThemeContext';

interface ScreenContainerProps {
    children: React.ReactNode;
    style?: ViewStyle;
    withScroll?: boolean;
    fullWidth?: boolean; // If false, adds standard padding
    animated?: boolean; // Enable entrance animation
}

const AnimatedSafeAreaView = Animated.createAnimatedComponent(SafeAreaView);

const ScreenContainerComponent: React.FC<ScreenContainerProps> = ({
    children,
    style,
    withScroll = false,
    fullWidth = false,
    animated = true,
}) => {
    const { theme, colors } = useTheme();
    const opacity = useSharedValue(animated ? 0 : 1);
    const translateY = useSharedValue(animated ? 8 : 0);

    useEffect(() => {
        if (animated) {
            opacity.value = withTiming(1, { duration: 250, easing: Easing.out(Easing.cubic) });
            translateY.value = withTiming(0, { duration: 250, easing: Easing.out(Easing.cubic) });
        }
    }, []);

    const animatedContentStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ translateY: translateY.value }],
    }));

    const contentStyle = useMemo(
        () => [styles.container, !fullWidth && { padding: layout.spacing.md }, style],
        [fullWidth, style]
    );

    const scrollContentStyle = useMemo(
        () => (!fullWidth ? { padding: layout.spacing.md } : undefined),
        [fullWidth]
    );

    const safeAreaStyle = useMemo(
        () => [styles.safeArea, { backgroundColor: colors.background }],
        [colors.background]
    );

    const Content = withScroll ? (
        <Animated.ScrollView
            style={[styles.container, animatedContentStyle]}
            contentContainerStyle={scrollContentStyle}
            showsVerticalScrollIndicator={false}
        >
            {children}
        </Animated.ScrollView>
    ) : (
        <Animated.View style={[contentStyle, animatedContentStyle]}>{children}</Animated.View>
    );

    return (
        <SafeAreaView style={safeAreaStyle}>
            <StatusBar
                barStyle={theme === 'dark' ? 'light-content' : 'dark-content'}
                backgroundColor={colors.background}
            />
            {Content}
        </SafeAreaView>
    );
};

export const ScreenContainer = memo(ScreenContainerComponent);

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    container: {
        flex: 1,
    },
});
