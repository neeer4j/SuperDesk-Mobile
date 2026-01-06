import React, { useMemo, memo } from 'react';
import { View, StyleSheet, StatusBar, SafeAreaView, ViewStyle, ScrollView } from 'react-native';
import { layout } from '../../theme/designSystem';
import { useTheme } from '../../context/ThemeContext';

interface ScreenContainerProps {
    children: React.ReactNode;
    style?: ViewStyle;
    withScroll?: boolean;
    fullWidth?: boolean; // If false, adds standard padding
}

const ScreenContainerComponent: React.FC<ScreenContainerProps> = ({
    children,
    style,
    withScroll = false,
    fullWidth = false,
}) => {
    const { theme, colors } = useTheme();

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
        <ScrollView
            style={styles.container}
            contentContainerStyle={scrollContentStyle}
            showsVerticalScrollIndicator={false}
        >
            {children}
        </ScrollView>
    ) : (
        <View style={contentStyle}>{children}</View>
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
