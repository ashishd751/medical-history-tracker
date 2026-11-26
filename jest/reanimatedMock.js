/**
 * Jest stand-in for `react-native-reanimated`.
 *
 * Reanimated 4's own mock imports `react-native-worklets`, whose native module does not exist under
 * Jest, so even the mock fails to load. The zoom viewer is verified on devices (T10); here the
 * primitives only need to exist and stay inert.
 */
const { Image, ScrollView, Text, View } = require('react-native');

/** Identity wrapper: a fake animated component still renders its children. */
const createAnimatedComponent = (component) => component;

const Animated = { View, Text, ScrollView, Image, createAnimatedComponent };

module.exports = {
  __esModule: true,
  default: Animated,
  createAnimatedComponent,
  useSharedValue: (initial) => ({ value: initial }),
  useAnimatedStyle: () => ({}),
  withTiming: (value) => value,
};
