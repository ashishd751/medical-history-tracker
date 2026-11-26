import Constants from 'expo-constants';

import { requireRepositories } from '@/data';
import { BMI_PRESETS, type BmiPreset, UNIT_SYSTEMS, type UnitSystem } from '@/domain';
import { useSession } from '@/lib/session';
import { AppCard, AppChoiceGrid, AppScreen, AppSectionHeader, AppText, strings } from '@/ui';

const UNIT_LABELS: Record<UnitSystem, string> = {
  metric: strings.settings.unitsMetric,
  imperial: strings.settings.unitsImperial,
};

const PRESET_LABELS: Record<BmiPreset, string> = {
  asian: strings.settings.bmiAsian,
  who: strings.settings.bmiWho,
};

const UNIT_OPTIONS = UNIT_SYSTEMS.map((value) => ({ value, label: UNIT_LABELS[value] }));
const PRESET_OPTIONS = BMI_PRESETS.map((value) => ({ value, label: PRESET_LABELS[value] }));

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
      <AppChoiceGrid
        options={UNIT_OPTIONS}
        selected={unitSystem}
        onSelect={(value) => save({ unitSystem: value })}
        columns={2}
        testIDPrefix="units"
      />

      <AppSectionHeader title={strings.settings.bmiPreset} />
      <AppChoiceGrid
        options={PRESET_OPTIONS}
        selected={bmiPreset}
        onSelect={(value) => save({ bmiPreset: value })}
        columns={2}
        testIDPrefix="bmi-preset"
      />
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
