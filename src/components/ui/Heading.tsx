import React, { useMemo, memo } from 'react';
import { Text, StyleSheet, TextProps, TextStyle } from 'react-native';
import { typography } from '../../theme/designSystem';
import { useTheme } from '../../context/ThemeContext';

interface HeadingProps extends TextProps {
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
    weight?: 'normal' | 'medium' | 'semibold' | 'bold' | 'extrabold';
    color?: string;
    children: React.ReactNode;
}

const HeadingComponent: React.FC<HeadingProps> = ({
    size = 'xl',
    weight = 'bold',
    color,
    children,
    style,
    ...props
}) => {
    const { colors } = useTheme();

    const fontSize = useMemo(() => {
        switch (size) {
            case 'sm':
                return typography.size.lg;
            case 'md':
                return typography.size.xl;
            case 'lg':
                return 22;
            case 'xl':
                return typography.size.xxl;
            case '2xl':
                return 36;
            case '3xl':
                return typography.size.xxxl;
            case '4xl':
                return 48;
            default:
                return typography.size.xxl;
        }
    }, [size]);

    const fontWeight = useMemo((): TextStyle['fontWeight'] => {
        switch (weight) {
            case 'normal':
                return '400';
            case 'medium':
                return '500';
            case 'semibold':
                return '600';
            case 'bold':
                return '700';
            case 'extrabold':
                return '800';
            default:
                return '700';
        }
    }, [weight]);

    const headingStyle = useMemo(
        () => [
            styles.heading,
            {
                fontSize,
                fontWeight,
                color: color || colors.text,
            },
            style,
        ],
        [fontSize, fontWeight, color, colors.text, style]
    );

    return (
        <Text style={headingStyle} {...props}>
            {children}
        </Text>
    );
};

export const Heading = memo(HeadingComponent);

const styles = StyleSheet.create({
    heading: {
        fontFamily: typography.fontFamily.bold,
    },
});
