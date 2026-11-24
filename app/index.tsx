import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton, AppCard, AppText, spacing, strings } from '@/ui';

/**
 * Placeholder route for Phase 0. Phase 1 replaces this with the onboarding/home
 * redirect. It exists so the app launches on both devices during the spikes.
 */
export default function IndexScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
      ]}
    >
      <AppText variant="display" accessibilityRole="header">
        {strings.app.name}
      </AppText>
      <AppText variant="body" color="muted">
        {strings.app.disclaimer}
      </AppText>

      <AppCard>
        <AppText variant="subtitle">Phase 0: foundations</AppText>
        <AppText variant="body" color="muted">
          Scaffold, tooling, design tokens and library spikes. No medical data is stored yet.
        </AppText>
      </AppCard>

      <View style={styles.actions}>
        <AppButton
          label="Open design system spike"
          variant="secondary"
          onPress={() => router.push('/dev/gallery')}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  actions: { gap: spacing.sm },
});
