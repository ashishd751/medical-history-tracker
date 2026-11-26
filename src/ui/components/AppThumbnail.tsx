import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '../ThemeProvider';
import { radius, spacing } from '../tokens';
import { AppText } from './AppText';

export interface AppThumbnailProps {
  /** Absolute URI, or null when the file is missing. */
  uri: string | null;
  /** Shown in place of the image when there is nothing to draw. */
  placeholder: string;
  size?: number;
  accessibilityLabel?: string;
  testID?: string;
}

/**
 * A square preview of a stored file.
 *
 * It draws on a white surface rather than the theme's surface: a stored JPEG was flattened onto
 * white, and a transparent PNG previewed on a dark background would look like a hole in the page.
 */
export function AppThumbnail({
  uri,
  placeholder,
  size = 96,
  accessibilityLabel,
  testID,
}: AppThumbnailProps) {
  const { colors } = useAppTheme();

  return (
    <View
      style={[
        styles.frame,
        { width: size, height: size, backgroundColor: uri ? '#FFFFFF' : colors.surfaceVariant },
      ]}
      testID={testID}
    >
      {uri ? (
        <Image
          source={uri}
          style={styles.image}
          contentFit="cover"
          transition={0}
          accessibilityLabel={accessibilityLabel}
          accessible={accessibilityLabel !== undefined}
        />
      ) : (
        <AppText variant="caption" color="muted" align="center" style={styles.placeholder}>
          {placeholder}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: radius.card,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%', height: '100%' },
  placeholder: { paddingHorizontal: spacing.xs },
});
