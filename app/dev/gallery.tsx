import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppBanner,
  AppButton,
  AppCard,
  AppChip,
  AppField,
  AppSheet,
  AppText,
  spacing,
  strings,
  useAppTheme,
} from '@/ui';

/**
 * SPIKE (a): visual parity screen. Shows every primitive so Android and iOS can be
 * compared side by side. Throwaway — deleted before Phase 1 ships.
 */
export default function GalleryScreen() {
  const insets = useSafeAreaInsets();
  const { colors, paper } = useAppTheme();
  const [text, setText] = useState('');
  const [sheetVisible, setSheetVisible] = useState(false);

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xxl },
      ]}
    >
      <AppText variant="title" accessibilityRole="header">
        {strings.dev.galleryTitle}
      </AppText>
      <AppText variant="caption" color="muted">
        {strings.dev.galleryHint}
      </AppText>

      <AppCard>
        <AppText variant="subtitle">Typography</AppText>
        <AppText variant="display">Display</AppText>
        <AppText variant="title">Title</AppText>
        <AppText variant="subtitle">Subtitle</AppText>
        <AppText variant="body">Body text, the default for content.</AppText>
        <AppText variant="label">Label</AppText>
        <AppText variant="caption" color="muted">
          Caption, muted
        </AppText>
      </AppCard>

      <AppCard>
        <AppText variant="subtitle">Colours</AppText>
        <View style={styles.swatches}>
          {[colors.primary, colors.success, colors.warning, colors.danger, colors.info].map(
            (color) => (
              <View key={color} style={[styles.swatch, { backgroundColor: color }]} />
            ),
          )}
        </View>
        <AppText variant="caption" color="muted">
          {`Paper roundness: ${paper.roundness ?? 'n/a'}`}
        </AppText>
      </AppCard>

      <AppCard>
        <AppText variant="subtitle">Buttons</AppText>
        <AppButton label="Primary" onPress={() => {}} />
        <AppButton label="Secondary" variant="secondary" onPress={() => {}} />
        <AppButton label="Quiet" variant="quiet" onPress={() => {}} />
        <AppButton label="Danger" variant="danger" onPress={() => {}} />
        <AppButton label="Sheet" variant="secondary" onPress={() => setSheetVisible(true)} />
      </AppCard>

      <AppCard>
        <AppText variant="subtitle">Chips</AppText>
        <View style={styles.row}>
          <AppChip label="Filter" selected onPress={() => {}} />
          <AppChip label="Unselected" onPress={() => {}} />
          <AppChip label="Check" tone="check" onPress={() => {}} />
        </View>
      </AppCard>

      <AppCard>
        <AppText variant="subtitle">Field</AppText>
        <AppField label="Field label" value={text} onChangeText={setText} />
        <AppField label="With error" value="" onChangeText={() => {}} error helperText="Required" />
      </AppCard>

      <AppBanner
        tone="info"
        title="General banner"
        message="Filled from your scan. Please check the details against the original before saving."
      />
      <AppBanner
        tone="warning"
        title="Handwritten prescription detected"
        message="Handwriting is hard to read automatically, so medicine names, doses and timings may be wrong."
      />
      <AppBanner
        tone="danger"
        title="Error"
        message="That file could not be found on this device."
      />

      <AppText variant="caption" color="muted" style={styles.footer}>
        {strings.app.disclaimer}
      </AppText>

      <AppSheet visible={sheetVisible} onDismiss={() => setSheetVisible(false)} title="Add record">
        <AppText variant="body">Sheet content goes here.</AppText>
        <AppButton label="Close" variant="quiet" onPress={() => setSheetVisible(false)} />
      </AppSheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  swatches: { flexDirection: 'row', gap: spacing.sm },
  swatch: { width: 44, height: 44, borderRadius: 8 },
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  footer: { textAlign: 'center', marginTop: spacing.lg },
});
