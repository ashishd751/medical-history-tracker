/* eslint-disable react-hooks/immutability -- Reanimated shared values are mutable by design: every
 * gesture handler writes `value.value`, which the React Compiler's immutability rule cannot model.
 * The writes happen in worklets on the UI thread, not during render. */
import { Image } from 'expo-image';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

export interface AppZoomableImageProps {
  /** Absolute URI of the stored image. */
  uri: string;
  accessibilityLabel?: string;
  testID?: string;
}

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;

/**
 * Full-screen image with pinch-zoom, pan and double-tap zoom.
 *
 * Built on the gesture handler and Reanimated that the app already ships (no new dependency).
 * Pan only moves a zoomed image, and zooming back out returns it to the centre, so the file can
 * never be dragged off-screen and lost.
 */
export function AppZoomableImage({ uri, accessibilityLabel, testID }: AppZoomableImageProps) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const pinch = useMemo(
    () =>
      Gesture.Pinch()
        .onUpdate((event) => {
          scale.value = Math.min(Math.max(savedScale.value * event.scale, MIN_SCALE), MAX_SCALE);
        })
        .onEnd(() => {
          savedScale.value = scale.value;
          if (scale.value <= MIN_SCALE) {
            translateX.value = withTiming(0);
            translateY.value = withTiming(0);
            savedX.value = 0;
            savedY.value = 0;
          }
        }),
    [savedScale, savedX, savedY, scale, translateX, translateY],
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .onUpdate((event) => {
          if (scale.value <= MIN_SCALE) return;
          translateX.value = savedX.value + event.translationX;
          translateY.value = savedY.value + event.translationY;
        })
        .onEnd(() => {
          savedX.value = translateX.value;
          savedY.value = translateY.value;
        }),
    [savedX, savedY, scale, translateX, translateY],
  );

  const doubleTap = useMemo(
    () =>
      Gesture.Tap()
        .numberOfTaps(2)
        .onEnd(() => {
          if (scale.value > MIN_SCALE) {
            scale.value = withTiming(MIN_SCALE);
            savedScale.value = MIN_SCALE;
            translateX.value = withTiming(0);
            translateY.value = withTiming(0);
            savedX.value = 0;
            savedY.value = 0;
            return;
          }
          scale.value = withTiming(DOUBLE_TAP_SCALE);
          savedScale.value = DOUBLE_TAP_SCALE;
        }),
    [savedScale, savedX, savedY, scale, translateX, translateY],
  );

  const gesture = useMemo(
    () => Gesture.Simultaneous(pinch, pan, doubleTap),
    [doubleTap, pan, pinch],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.viewport} testID={testID}>
        <Animated.View style={[styles.canvas, animatedStyle]}>
          <Image
            source={uri}
            style={styles.image}
            contentFit="contain"
            accessibilityLabel={accessibilityLabel}
            accessible={accessibilityLabel !== undefined}
          />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1, overflow: 'hidden', justifyContent: 'center' },
  canvas: { width: '100%', height: '100%' },
  image: { width: '100%', height: '100%' },
});
