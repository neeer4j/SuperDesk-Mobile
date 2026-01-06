import React, { memo, useMemo, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    runOnJS,
} from 'react-native-reanimated';
import { hapticService } from '../services/HapticService';

// Wrapper to avoid Reanimated capture error
const triggerHaptic = () => {
    hapticService.medium();
};

interface JoystickProps {
    onMove: (dx: number, dy: number) => void;
    onPress: () => void;
    size?: number;
    color?: string;
}

const JoystickComponent: React.FC<JoystickProps> = ({
    onMove,
    onPress,
    size = 150,
    color = 'rgba(255, 255, 255, 0.5)',
}) => {
    const knobSize = useMemo(() => size / 2.5, [size]);
    const maxRadius = useMemo(() => size / 2 - knobSize / 2, [size, knobSize]);

    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);

    // Memoize the move handler to prevent recreation
    const handleMove = useCallback(
        (normalizedX: number, normalizedY: number) => {
            const sensitivity = 0.015;
            onMove(normalizedX * sensitivity, normalizedY * sensitivity);
        },
        [onMove],
    );

    // Memoize the press handler
    const handlePress = useCallback(() => {
        onPress();
    }, [onPress]);

    const panGesture = useMemo(
        () =>
            Gesture.Pan()
                .onUpdate(event => {
                    const translationX = event.translationX;
                    const translationY = event.translationY;

                    // Constrain knob within radius
                    const distance = Math.sqrt(translationX ** 2 + translationY ** 2);
                    let constrainedX = translationX;
                    let constrainedY = translationY;

                    if (distance > maxRadius) {
                        const angle = Math.atan2(translationY, translationX);
                        constrainedX = Math.cos(angle) * maxRadius;
                        constrainedY = Math.sin(angle) * maxRadius;
                    }

                    translateX.value = constrainedX;
                    translateY.value = constrainedY;

                    // Calculate normalized output (-1 to 1)
                    const normalizedX = constrainedX / maxRadius;
                    const normalizedY = constrainedY / maxRadius;

                    runOnJS(handleMove)(normalizedX, normalizedY);
                })
                .onEnd(() => {
                    translateX.value = withSpring(0);
                    translateY.value = withSpring(0);
                }),
        [maxRadius, translateX, translateY, handleMove],
    );

    const tapGesture = useMemo(
        () =>
            Gesture.Tap()
                .maxDistance(5)
                .onEnd(() => {
                    runOnJS(triggerHaptic)();
                    runOnJS(handlePress)();
                }),
        [handlePress],
    );

    const composedGesture = useMemo(
        () => Gesture.Simultaneous(panGesture, tapGesture),
        [panGesture, tapGesture],
    );

    const knobStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
    }));

    const containerStyle = useMemo(
        () => [
            styles.container,
            {
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: 'rgba(0,0,0,0.3)',
            },
        ],
        [size],
    );

    const knobViewStyle = useMemo(
        () => [
            styles.knob,
            {
                width: knobSize,
                height: knobSize,
                borderRadius: knobSize / 2,
                backgroundColor: color,
            },
        ],
        [knobSize, color],
    );

    return (
        <View style={containerStyle}>
            <GestureDetector gesture={composedGesture}>
                <Animated.View style={[knobViewStyle, knobStyle]} />
            </GestureDetector>
        </View>
    );
};

// Memoize the component to prevent unnecessary re-renders
const Joystick = memo(JoystickComponent);

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    knob: {
        position: 'absolute',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
});

export default Joystick;
