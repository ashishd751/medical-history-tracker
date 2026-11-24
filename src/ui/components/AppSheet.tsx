import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '../ThemeProvider';
import { radius, spacing } from '../tokens';
import { AppText } from './AppText';

export interface AppSheetProps {
  visible: boolean;
  onDismiss: () => void;
  title?: string | undefined;
  children: ReactNode;
  testID?: string;
}

/**
 * Bottom sheet built on RN's Modal (no extra dependency). Used for the add-actions
 * sheet and the "Profile updated" sheet.
 */
export function AppSheet({ visible, onDismiss, title, children, testID }: AppSheetProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Close sheet"
        />
        <View
          testID={testID}
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              paddingBottom: Math.max(insets.bottom, spacing.lg),
            },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          {title ? (
            <AppText variant="subtitle" accessibilityRole="header" style={styles.title}>
              {title}
            </AppText>
          ) : null}
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    borderTopLeftRadius: radius.card * 1.5,
    borderTopRightRadius: radius.card * 1.5,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.xs,
  },
  title: { marginBottom: spacing.xs },
});
