/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['react-native-gesture-handler/jestSetup'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // Reanimated 4's own mock imports react-native-worklets, which has no Jest native module, so a
  // minimal inert stand-in is used instead. Gesture handlers and animations run on devices (T10).
  moduleNameMapper: {
    '^react-native-reanimated$': '<rootDir>/jest/reanimatedMock.js',
  },
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
};
