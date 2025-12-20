import React from 'react';
import { View, StyleSheet, StatusBar, SafeAreaView, ViewStyle, ScrollView } from 'react-native';
import { layout } from '../../theme/designSystem';
import { useTheme } from '../../context/ThemeContext';

interface ScreenContainerProps {
    children: React.ReactNode;
    style?: ViewStyle;
    withScroll?: boolean;
    fullWidth?: boolean; // If false, adds standard padding
}

export const ScreenContainer: React.FC<ScreenContainerProps> = ({
    children,
    style,
    withScroll = false,
    fullWidth = false,
}) => {
    const { theme, colors } = useTheme();

    const contentStyle = [
        styles.container,
        !fullWidth && { padding: layout.spacing.md },
        style,
    ];

    const Content = withScroll ? (
        <ScrollView
            style={styles.container}
            contentContainerStyle={!fullWidth ? { padding: layout.spacing.md } : undefined}
            showsVerticalScrollIndicator={false}
        >
            {children}
        </ScrollView>
    ) : (
        <View style={contentStyle}>{children}</View>
    );

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
            <StatusBar
                barStyle={theme === 'dark' ? 'light-content' : 'dark-content'}
                backgroundColor={colors.background}
            />
            {Content}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    container: {
        flex: 1,
    },
});
