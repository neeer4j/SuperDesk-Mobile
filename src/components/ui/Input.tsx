import React, { memo, useMemo } from 'react';
import {
    TextInput,
    View,
    Text,
    StyleSheet,
    TextInputProps,
    ViewStyle,
    TextStyle,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { layout, typography } from '../../theme/designSystem';

interface InputProps extends TextInputProps {
    label?: string;
    error?: string;
    containerStyle?: ViewStyle;
    inputStyle?: TextStyle;
    size?: 'md' | 'lg' | 'xl';
}

const InputComponent: React.FC<InputProps> = ({
    label,
    error,
    containerStyle,
    inputStyle,
    size = 'md',
    ...textInputProps
}) => {
    const { colors } = useTheme();

    const height = useMemo(() => {
        switch (size) {
            case 'lg':
                return 52;
            case 'xl':
                return 60;
            default:
                return 44;
        }
    }, [size]);

    const fontSize = useMemo(() => {
        switch (size) {
            case 'lg':
                return typography.size.lg;
            case 'xl':
                return typography.size.xl;
            default:
                return typography.size.md;
        }
    }, [size]);

    const inputStyles = useMemo(
        () => [
            styles.input,
            {
                backgroundColor: colors.card,
                borderColor: error ? colors.error : colors.border,
                color: colors.text,
                height,
                fontSize,
            },
            inputStyle,
        ],
        [colors, error, height, fontSize, inputStyle],
    );

    return (
        <View style={[styles.container, containerStyle]}>
            {label && <Text style={[styles.label, { color: colors.subText }]}>{label}</Text>}
            <TextInput
                style={inputStyles}
                placeholderTextColor={colors.subText}
                {...textInputProps}
            />
            {error && <Text style={[styles.error, { color: colors.error }]}>{error}</Text>}
        </View>
    );
};

// Memoize the component to prevent unnecessary re-renders
export const Input = memo(InputComponent);

const styles = StyleSheet.create({
    container: {
        marginBottom: layout.spacing.md,
    },
    label: {
        fontSize: typography.size.sm,
        fontFamily: typography.fontFamily.medium,
        marginBottom: layout.spacing.xs,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    input: {
        borderWidth: 1,
        borderRadius: layout.borderRadius.lg,
        paddingHorizontal: layout.spacing.md,
        fontFamily: typography.fontFamily.regular,
    },
    error: {
        fontSize: typography.size.sm,
        marginTop: layout.spacing.xs,
    },
});
