/**
 * The single host for the "Profile updated" sheet.
 *
 * It sits at the shell level because the sheet must survive the navigation that follows the change:
 * a save opens the record's detail screen, a delete goes back to wherever the user came from. One
 * host above the navigator also means a second save replaces the sheet rather than stacking two
 * (ADR-040).
 */
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { requireRepositories } from '@/data';
import {
  dismissProfileChange,
  type ProfileChangeReport,
  useProfileChange,
} from '@/lib/profileChangeStore';
import { useSession } from '@/lib/session';
import {
  AppBanner,
  AppButton,
  AppChangeList,
  AppSheet,
  AppText,
  formatProfileChanges,
  spacing,
  strings,
} from '@/ui';

export function ProfileChangeHost() {
  const report = useProfileChange();
  const { personId, unitSystem, refresh } = useSession();
  const [undone, setUndone] = useState<ProfileChangeReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!report) return null;

  const isUndone = undone === report;
  const rows = formatProfileChanges(report.changes, unitSystem);

  const close = () => {
    setUndone(null);
    setError(null);
    dismissProfileChange();
  };

  const undo = () => {
    if (!personId || !report.undo) return;
    const result = requireRepositories().profile.undo(personId, report.undo);
    if (!result.ok) {
      setError(strings.errors.db);
      return;
    }
    setError(null);
    setUndone(report);
    // Home and Profile read the same queries, so one invalidation moves both.
    refresh();
  };

  const note =
    report.undoUnavailable === 'edit'
      ? strings.profile.undoUnavailableEdit
      : report.undoUnavailable === 'delete'
        ? strings.profile.undoUnavailableDelete
        : strings.profile.updatedHint;

  return (
    <AppSheet
      visible
      onDismiss={close}
      title={strings.profile.updatedTitle}
      testID="profile-updated-sheet"
    >
      {error ? <AppBanner tone="danger" message={error} /> : null}

      {isUndone ? (
        <AppBanner tone="success" message={strings.profile.undone} testID="profile-undo-done" />
      ) : (
        <>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.rows}>
            <AppChangeList rows={rows} testID="profile-change-list" />
          </ScrollView>
          <AppText variant="caption" color="muted" testID="profile-change-note">
            {note}
          </AppText>
        </>
      )}

      <View style={styles.actions}>
        {report.undo !== null && !isUndone ? (
          <AppButton
            label={strings.profile.undo}
            variant="secondary"
            onPress={undo}
            fullWidth
            testID="profile-undo"
          />
        ) : null}
        <AppButton label={strings.common.done} onPress={close} fullWidth testID="profile-done" />
      </View>
    </AppSheet>
  );
}

const styles = StyleSheet.create({
  // A long change list at the largest text size must scroll rather than push the buttons off
  // screen; the sheet itself does not scroll (ADR-042).
  scroll: { maxHeight: 360 },
  rows: { paddingBottom: spacing.xs },
  actions: { gap: spacing.sm },
});
