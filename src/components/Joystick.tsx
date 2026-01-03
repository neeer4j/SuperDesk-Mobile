import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
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

const Joystick: React.FC<JoystickProps> = ({
    onMove,
    onPress,
    size = 150,
    color = 'rgba(255, 255, 255, 0.5)',
}) => {
    const knobSize = size / 2.5;
    const maxRadius = size / 2 - knobSize / 2;

    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);

    const panGesture = Gesture.Pan()
        .onUpdate((event) => {
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

            // Sensitivity factor - adjust based on preference
            const sensitivity = 0.015; // Move cursor by 1.5% of screen per update

            runOnJS(onMove)(normalizedX * sensitivity, normalizedY * sensitivity);
        })
        .onEnd(() => {
            translateX.value = withSpring(0);
            translateY.value = withSpring(0);
        });

    const tapGesture = Gesture.Tap()
        .maxDistance(5) // Prevent accidental clicks while dragging
        .onEnd(() => {
            runOnJS(triggerHaptic)();
            runOnJS(onPress)();
        });

    const composedGesture = Gesture.Simultaneous(panGesture, tapGesture);

    const knobStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
        ],
    }));

    return (
        <View style={[styles.container, { width: size, height: size, borderRadius: size / 2, backgroundColor: 'rgba(0,0,0,0.3)' }]}>
            <GestureDetector gesture={composedGesture}>
                <Animated.View
                    style={[
                        styles.knob,
                        knobStyle,
                        {
                            width: knobSize,
                            height: knobSize,
                            borderRadius: knobSize / 2,
                            backgroundColor: color,
                        },
                    ]}
                />
            </GestureDetector>
        </View>
    );
};

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
