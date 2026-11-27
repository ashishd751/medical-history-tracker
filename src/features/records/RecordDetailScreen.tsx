import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { getFileStore, requireRepositories } from '@/data';
import { formatDisplayDate, todayIso } from '@/lib/dates';
import { publishProfileChange } from '@/lib/profileChangeStore';
import { useSession } from '@/lib/session';
import {
  AppBanner,
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

import { fileSharer, getAttachmentService } from './attachments/attachmentDeps';
import { AttachmentGallery, groupAttachments } from './attachments/AttachmentGallery';
import { DetailField } from './detail/DetailField';
import { MedicationList } from './detail/MedicationList';
import { ReadingsTable } from './detail/ReadingsTable';
import { VitalsList } from './detail/VitalsList';
import { buildProfileChangeReport, readProfile } from './profileSync';

/** Everything about one record, with edit and a confirmed delete. */
export function RecordDetailScreen({ recordId }: { recordId: string }) {
  const { personId, unitSystem, bmiPreset, refresh } = useSession();
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
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

  const { record, medications, readings, measurements, attachments } = detail.data;
  const doctor = record.doctorId
    ? doctors.data?.find((candidate) => candidate.id === record.doctorId)
    : undefined;

  const remove = () => {
    const repositories = requireRepositories();
    const profileRequest = { personId: id, today: todayIso(), bmiPreset };
    // Capture the profile first: deleting the record cascades to its measurements and
    // medications, and the diff is what explains the change that follows (ADR-041).
    const profileBefore = readProfile(repositories, profileRequest);

    const result = repositories.records.remove(id, recordId);
    setConfirmDelete(false);
    if (!result.ok) return;
    // The rows are gone (committed); the files go now. A failure here leaves an orphan that the
    // next launch's sweeper removes.
    void getAttachmentService().deleteFiles(result.value.attachmentPaths);

    // The profile is derived, so it has already reverted. There is nothing left to undo — the
    // record and its values are gone — so the sheet explains rather than offering one.
    publishProfileChange(
      buildProfileChangeReport({
        before: profileBefore,
        after: readProfile(repositories, profileRequest),
        undo: null,
        undoUnavailable: 'delete',
      }),
    );

    refresh();
    router.back();
  };

  const gallery = groupAttachments(attachments, getFileStore());

  const shareAttachment = async (attachmentId: string) => {
    const row = attachments.find((attachment) => attachment.id === attachmentId);
    if (!row) return;
    const files = getFileStore();
    if (!files.exists(row.relPath)) {
      setBanner(strings.attachments.fileMissing);
      return;
    }
    try {
      const outcome = await fileSharer.share(files.toUri(row.relPath), {
        mimeType: row.mime,
        title: strings.attachments.open,
      });
      setBanner(outcome === 'unavailable' ? strings.attachments.shareUnavailable : null);
    } catch {
      setBanner(strings.attachments.shareUnavailable);
    }
  };

  return (
    <AppScreen
      title={record.title}
      // The type was a badge in the row below, where its `alignSelf: 'flex-start'` left it floating
      // above the centred date. As the eyebrow it reads as the record's category, above the title,
      // and the row below is just the date and Edit (device review).
      eyebrow={recordKindLabel(record.kind)}
      onBack={() => router.back()}
      testID="screen-record-detail"
    >
      {banner ? <AppBanner tone="warning" message={banner} testID="detail-banner" /> : null}
      <View style={styles.head}>
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

      {attachments.length > 0 ? (
        <AppCard>
          <AppText variant="caption" color="muted">
            {strings.recordDetail.attachments}
          </AppText>
          <AttachmentGallery
            groups={gallery}
            onOpen={(attachmentId) => router.push(`/attachment/${attachmentId}`)}
            onShare={(attachmentId) => void shareAttachment(attachmentId)}
            testID="record-attachments"
          />
        </AppCard>
      ) : null}

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
