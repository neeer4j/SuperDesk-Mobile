import React, { useMemo, memo } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { layout } from '../../theme/designSystem';

interface StackProps {
    children: React.ReactNode;
    direction?: 'vertical' | 'horizontal';
    spacing?: keyof typeof layout.spacing;
    align?: 'flex-start' | 'center' | 'flex-end' | 'stretch';
    justify?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around';
    style?: ViewStyle;
}

const StackComponent: React.FC<StackProps> = ({
    children,
    direction = 'vertical',
    spacing = 'md',
    align = 'stretch',
    justify = 'flex-start',
    style,
}) => {
    const stackStyle = useMemo(
        () => [
            styles.stack,
            {
                flexDirection: direction === 'horizontal' ? 'row' : 'column',
                alignItems: align,
                justifyContent: justify,
                gap: layout.spacing[spacing],
            } as ViewStyle,
            style,
        ],
        [direction, spacing, align, justify, style]
    );

    return <View style={stackStyle}>{children}</View>;
};

export const Stack = memo(StackComponent);

// Convenience components
export const VStack: React.FC<Omit<StackProps, 'direction'>> = memo((props) => (
    <Stack {...props} direction="vertical" />
));

export const HStack: React.FC<Omit<StackProps, 'direction'>> = memo((props) => (
    <Stack {...props} direction="horizontal" />
));

const styles = StyleSheet.create({
    stack: {
        // Base styles
    },
});
