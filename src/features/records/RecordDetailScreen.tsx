import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { requireRepositories } from '@/data';
import { formatDisplayDate } from '@/lib/dates';
import { useSession } from '@/lib/session';
import {
  AppBadge,
  AppButton,
  AppCard,
  AppChip,
  AppDialog,
  AppEmptyState,
  AppScreen,
  AppText,
  recordKindLabel,
  spacing,
  strings,
} from '@/ui';

import { DetailField } from './detail/DetailField';
import { MedicationList } from './detail/MedicationList';
import { ReadingsTable } from './detail/ReadingsTable';
import { VitalsList } from './detail/VitalsList';

/** Everything about one record, with edit and a confirmed delete. */
export function RecordDetailScreen({ recordId }: { recordId: string }) {
  const { personId, unitSystem, refresh } = useSession();
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const id = personId ?? '';

  const detail = useQuery({
    queryKey: ['record', id, recordId],
    queryFn: () => requireRepositories().records.getDetail(id, recordId),
    enabled: id !== '',
  });
  const doctors = useQuery({
    queryKey: ['doctors'],
    queryFn: () => requireRepositories().doctors.list(),
    enabled: id !== '',
  });

  if (!detail.data) {
    return (
      <AppScreen title={strings.recordDetail.title} onBack={() => router.back()}>
        <AppEmptyState
          title={detail.isFetched ? strings.recordDetail.missing : strings.common.loading}
        />
      </AppScreen>
    );
  }

  const { record, medications, readings, measurements } = detail.data;
  const doctor = record.doctorId
    ? doctors.data?.find((candidate) => candidate.id === record.doctorId)
    : undefined;

  const remove = () => {
    const result = requireRepositories().records.remove(id, recordId);
    setConfirmDelete(false);
    if (!result.ok) return;
    refresh();
    router.back();
  };

  return (
    <AppScreen title={record.title} onBack={() => router.back()} testID="screen-record-detail">
      <View style={styles.head}>
        <AppBadge label={recordKindLabel(record.kind)} tone="primary" />
        <AppText variant="label" testID="detail-date">
          {formatDisplayDate(record.date)}
        </AppText>
        <View style={styles.headSpacer} />
        {/* In the body rather than the header: the header's top-right corner is where the dev
            client draws its floating menu button in development builds. */}
        <AppButton
          label={strings.common.edit}
          variant="secondary"
          onPress={() => router.push(`/record/${recordId}/edit`)}
          testID="edit-record"
        />
      </View>

      {record.symptoms.length > 0 ? (
        <AppCard>
          <AppText variant="caption" color="muted">
            {strings.recordDetail.symptoms}
          </AppText>
          <View style={styles.chips}>
            {record.symptoms.map((symptom) => (
              <AppChip key={symptom} label={symptom} />
            ))}
          </View>
        </AppCard>
      ) : null}

      {record.condition ? (
        <DetailField label={strings.recordDetail.condition} value={record.condition} />
      ) : null}
      {doctor ? <DetailField label={strings.recordDetail.doctor} value={doctor.name} /> : null}
      {record.facility ? (
        <DetailField label={strings.recordDetail.facility} value={record.facility} />
      ) : null}
      {record.followUpOn ? (
        <DetailField
          label={strings.recordDetail.followUp}
          value={formatDisplayDate(record.followUpOn)}
        />
      ) : null}

      <MedicationList medications={medications} />
      <ReadingsTable readings={readings} />
      <VitalsList measurements={measurements} unitSystem={unitSystem} />

      {record.prescriptionText ? (
        <DetailField label={strings.recordDetail.prescription} value={record.prescriptionText} />
      ) : null}
      {record.comments ? (
        <DetailField label={strings.recordDetail.comments} value={record.comments} />
      ) : null}

      <AppButton
        label={strings.common.delete}
        variant="danger"
        onPress={() => setConfirmDelete(true)}
        fullWidth
        testID="delete-record"
      />

      <AppText variant="caption" color="muted">
        {strings.app.disclaimer}
      </AppText>

      <AppDialog
        visible={confirmDelete}
        title={strings.recordDetail.deleteTitle}
        message={strings.recordDetail.deleteBody}
        confirmLabel={strings.recordDetail.deleteConfirm}
        cancelLabel={strings.common.cancel}
        destructive
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
        testID="delete-dialog"
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headSpacer: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
