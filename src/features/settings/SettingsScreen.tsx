import Constants from 'expo-constants';
import { StyleSheet, View } from 'react-native';

import { requireRepositories } from '@/data';
import { BMI_PRESETS, type BmiPreset, UNIT_SYSTEMS, type UnitSystem } from '@/domain';
import { useSession } from '@/lib/session';
import { AppCard, AppChip, AppScreen, AppSectionHeader, AppText, spacing, strings } from '@/ui';

const UNIT_LABELS: Record<UnitSystem, string> = {
  metric: strings.settings.unitsMetric,
  imperial: strings.settings.unitsImperial,
};

const PRESET_LABELS: Record<BmiPreset, string> = {
  asian: strings.settings.bmiAsian,
  who: strings.settings.bmiWho,
};

/** Units, BMI reference and the privacy statement. */
export function SettingsScreen() {
  const { unitSystem, bmiPreset, refresh } = useSession();

  const save = (patch: { unitSystem?: UnitSystem; bmiPreset?: BmiPreset }) => {
    const result = requireRepositories().settings.updateSettings(patch);
    if (result.ok) refresh();
  };

  return (
    <AppScreen title={strings.settings.title} testID="screen-settings">
      <AppSectionHeader title={strings.settings.units} />
      <View style={styles.chips}>
        {UNIT_SYSTEMS.map((option) => (
          <AppChip
            key={option}
            label={UNIT_LABELS[option]}
            selected={unitSystem === option}
            onPress={() => save({ unitSystem: option })}
            testID={`units-${option}`}
          />
        ))}
      </View>

      <AppSectionHeader title={strings.settings.bmiPreset} />
      <View style={styles.chips}>
        {BMI_PRESETS.map((option) => (
          <AppChip
            key={option}
            label={PRESET_LABELS[option]}
            selected={bmiPreset === option}
            onPress={() => save({ bmiPreset: option })}
            testID={`bmi-preset-${option}`}
          />
        ))}
      </View>
      <AppText variant="caption" color="muted">
        {strings.settings.bmiHint}
      </AppText>

      <AppSectionHeader title={strings.settings.about} />
      <AppCard>
        <AppText variant="label">{`${strings.settings.version} ${Constants.expoConfig?.version ?? '—'}`}</AppText>
        <AppText variant="body" color="muted">
          {strings.settings.privacyBody}
        </AppText>
        <AppText variant="caption" color="muted">
          {strings.app.offline}
        </AppText>
      </AppCard>

      <AppText variant="caption" color="muted">
        {strings.app.disclaimer}
      </AppText>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
