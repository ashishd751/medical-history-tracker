import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native';

import { attachmentPathsOf, getFileStore, requireRepositories } from '@/data';
import { FACILITY_KINDS, MAX_ATTACHMENTS_PER_RECORD, type RecordKind } from '@/domain';
import { todayIso } from '@/lib/dates';
import { uuidv7 } from '@/lib/ids';
import { publishProfileChange } from '@/lib/profileChangeStore';
import { useSession } from '@/lib/session';
import {
  AppBanner,
  AppButton,
  AppDialog,
  AppEmptyState,
  AppField,
  AppScreen,
  AppText,
  attachmentRoleLabel,
  spacing,
  strings,
} from '@/ui';

import { getAttachmentService } from './attachments/attachmentDeps';
import type { StagedAttachment } from './attachments/attachmentDraft';
import type { AttachmentGridItem } from './attachments/AttachmentGrid';
import { type AttachmentAction, AttachmentSection } from './attachments/AttachmentSection';
import { MedicationsRepeater } from './form/MedicationsRepeater';
import { ReadingsRepeater } from './form/ReadingsRepeater';
import { RecordBasicsFields } from './form/RecordBasicsFields';
import { VitalsFields } from './form/VitalsFields';
import { buildProfileChangeReport, readProfile, undoPlanForRecord } from './profileSync';
import { emptyForm, parseDraft, toFormValues, toRecordInput } from './recordFormMapping';
import { createRecordFormSchema, type RecordFormValues } from './recordFormSchema';

const MAX = MAX_ATTACHMENTS_PER_RECORD;

/**
 * Create or edit a record.
 *
 * The record, its medications, its readings, its vitals and its attachments are one form and one
 * transaction. Picked files are staged in the draft's folder while the form is open (ADR-030), the
 * draft (including those files) survives a restart (ADR-022), and Save moves the files into place
 * before writing the rows in one transaction — rolling the files back if that transaction fails.
 */
export function RecordFormScreen({ recordId }: { recordId?: string }) {
  const { personId, unitSystem, bmiPreset, refresh } = useSession();
  const router = useRouter();
  const schema = useMemo(() => createRecordFormSchema(unitSystem), [unitSystem]);

  // The repositories are synchronous, so the initial values can be read during render instead
  // of being loaded into the form from an effect (which the compiler lint rule rejects).
  const detail = useMemo(
    () =>
      recordId && personId ? requireRepositories().records.getDetail(personId, recordId) : null,
    [recordId, personId],
  );
  const missing = Boolean(recordId) && detail === null;

  const bootstrap = useMemo<{
    values: RecordFormValues;
    fromDraft: boolean;
    draftId: string;
    staged: readonly StagedAttachment[];
  }>(() => {
    if (detail) {
      const doctor = detail.record.doctorId
        ? requireRepositories().doctors.getById(detail.record.doctorId)
        : null;
      return {
        values: toFormValues(detail, unitSystem, doctor?.name ?? ''),
        fromDraft: false,
        draftId: uuidv7(),
        staged: [],
      };
    }
    if (recordId) {
      return { values: emptyForm(), fromDraft: false, draftId: uuidv7(), staged: [] };
    }
    const draft = parseDraft(requireRepositories().settings.getRecordDraft());
    if (draft && draft.recordId === null) {
      return {
        values: draft.values,
        fromDraft: true,
        // A draft written before Phase 2 has no id; give it one so new files have a home.
        draftId: draft.draftId ?? uuidv7(),
        staged: draft.attachments,
      };
    }
    return { values: emptyForm(), fromDraft: false, draftId: uuidv7(), staged: [] };
  }, [detail, recordId, unitSystem]);

  const doctors = useQuery({
    queryKey: ['doctors'],
    queryFn: () => requireRepositories().doctors.list(),
  });

  const {
    control,
    handleSubmit,
    setValue,
    formState: { isDirty },
  } = useForm<RecordFormValues>({
    resolver: zodResolver(schema),
    defaultValues: bootstrap.values,
    mode: 'onBlur',
  });

  const [leaveOpen, setLeaveOpen] = useState(false);
  const [banner, setBanner] = useState<string | null>(
    bootstrap.fromDraft ? strings.recordForm.draftRestored : null,
  );
  const [staged, setStaged] = useState<readonly StagedAttachment[]>(bootstrap.staged);
  const [removedIds, setRemovedIds] = useState<readonly string[]>([]);
  const [attachmentsTouched, setAttachmentsTouched] = useState(bootstrap.staged.length > 0);
  const [busy, setBusy] = useState(false);

  const draftId = bootstrap.draftId;

  // Files staged while the form is open are unsaved work even when the text fields are untouched.
  const dirty = isDirty || attachmentsTouched;

  // Android's hardware back must respect the same guard as the header button; without this a
  // back press silently discards a half-typed record.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!dirty) return false;
      setLeaveOpen(true);
      return true;
    });
    return () => subscription.remove();
  }, [dirty]);

  // `useWatch` rather than `watch()`: the compiler-aware lint rule rejects `watch()`, and this
  // subscribes to the whole form so the draft can be saved while typing.
  const values = useWatch({ control }) as RecordFormValues;

  useEffect(() => {
    // Only a user edit is worth keeping; opening a record must not overwrite a newer draft.
    if (!dirty) return;
    const timer = setTimeout(() => {
      requireRepositories().settings.saveRecordDraft(
        JSON.stringify({ recordId: recordId ?? null, draftId, values, attachments: staged }),
      );
    }, 400);
    return () => clearTimeout(timer);
  }, [values, staged, dirty, recordId, draftId]);

  const existing = detail?.attachments ?? [];
  const visibleExisting = existing.filter((row) => !removedIds.includes(row.id));
  const files = getFileStore();

  const itemsFor = (roles: readonly StagedAttachment['role'][]): AttachmentGridItem[] => {
    const fromStaged = staged
      .filter((attachment) => roles.includes(attachment.role))
      .map((attachment) => ({
        id: attachment.id,
        label: attachmentRoleLabel(attachment.role),
        thumbnailUri: files.exists(attachment.stagedThumbRelPath)
          ? files.toUri(attachment.stagedThumbRelPath)
          : null,
      }));
    const fromExisting = visibleExisting
      .filter((row) => roles.includes(row.role))
      .map((row) => ({
        id: row.id,
        label: attachmentRoleLabel(row.role),
        thumbnailUri:
          row.thumbRelPath && files.exists(row.thumbRelPath) ? files.toUri(row.thumbRelPath) : null,
      }));
    return [...fromStaged, ...fromExisting];
  };

  const total = staged.length + visibleExisting.length;
  const atLimit = total >= MAX;

  const prescriptionActions: AttachmentAction[] = [
    { label: strings.attachments.addPhoto, source: 'photo', role: 'prescription' },
    { label: strings.attachments.addFile, source: 'file', role: 'prescription' },
  ];
  const reportActions: AttachmentAction[] = [
    { label: strings.attachments.addPhoto, source: 'photo', role: 'lab_report' },
    { label: strings.attachments.addLabReport, source: 'file', role: 'lab_report' },
    { label: strings.attachments.addOtherFile, source: 'file', role: 'other' },
  ];

  const pick = async (action: AttachmentAction) => {
    if (!personId) return;
    if (total >= MAX) {
      setBanner(strings.attachments.limitReached(MAX));
      return;
    }
    setBusy(true);
    try {
      const service = getAttachmentService();
      const request = {
        role: action.role,
        personId,
        draftId,
        existingCount: total,
      };
      const result =
        action.source === 'photo'
          ? await service.importFromLibrary(request)
          : await service.importFromFiles(request);

      if (result.status === 'cancelled') return;
      if (result.status === 'denied') {
        setBanner(
          result.limited ? strings.attachments.limitedAccess : strings.attachments.accessDenied,
        );
        return;
      }
      if (result.status === 'failed') {
        setBanner(result.problem.message);
        return;
      }

      if (result.attachments.length > 0) {
        setStaged((current) => [...current, ...result.attachments]);
        setAttachmentsTouched(true);
      }
      if (result.problems.length > 0) setBanner(result.problems[0]?.message ?? null);
      else if (result.limited) setBanner(strings.attachments.limitedAccess);
      else setBanner(null);
    } finally {
      setBusy(false);
    }
  };

  const removeAttachment = (id: string) => {
    const stagedOne = staged.find((attachment) => attachment.id === id);
    if (stagedOne) {
      // A staged file is not referenced by anything yet, so it can go at once.
      void getAttachmentService().removeStaged([stagedOne]);
      setStaged((current) => current.filter((attachment) => attachment.id !== id));
    } else {
      // An existing row is removed in the save transaction; its file goes after the commit.
      setRemovedIds((current) => [...current, id]);
    }
    setAttachmentsTouched(true);
  };

  const onChangeKind = (kind: RecordKind) => {
    setValue('kind', kind, { shouldDirty: true });
    if (!FACILITY_KINDS.includes(kind)) setValue('facility', '', { shouldDirty: true });
  };

  const onSubmit = handleSubmit(async (formValues) => {
    if (!personId) return;
    const repositories = requireRepositories();

    // Capture the profile before the write, so the diff describes exactly what this save did.
    const profileRequest = { personId, today: todayIso(), bmiPreset };
    const profileBefore = readProfile(repositories, profileRequest);

    setBusy(true);
    try {
      let doctorId: string | null = null;
      if (formValues.doctorName.trim()) {
        const doctor = repositories.doctors.ensure({
          name: formValues.doctorName,
          specialty: formValues.specialty,
        });
        if (!doctor.ok) {
          setBanner(strings.recordForm.saveFailed);
          return;
        }
        doctorId = doctor.value.id;
      }

      const targetRecordId = recordId ?? uuidv7();
      const service = getAttachmentService();

      // 1. Files first: the rows can point at them only once they exist.
      const moved = await service.moveIntoPlace({
        personId,
        recordId: targetRecordId,
        staged,
      });
      if (!moved.ok) {
        setBanner(strings.attachments.filesSaveFailed);
        return;
      }

      // 2. One transaction for the record, its children and its attachments.
      const input = {
        ...toRecordInput(formValues, unitSystem),
        doctorId,
        attachments: moved.inputs,
      };
      const saved = recordId
        ? repositories.records.update(personId, recordId, {
            ...input,
            removedAttachmentIds: removedIds,
          })
        : repositories.records.create(personId, { ...input, id: targetRecordId });

      if (!saved.ok) {
        // The rows did not land, so the files must not either.
        await service.rollbackToStaging({ personId, recordId: targetRecordId, staged });
        setBanner(strings.attachments.filesSaveFailed);
        return;
      }

      // 3. After the commit: delete removed rows' files and the now-empty staging folder.
      const removedPaths = existing
        .filter((row) => removedIds.includes(row.id))
        .flatMap((row) => attachmentPathsOf(row));
      await service.deleteFiles(removedPaths);
      await service.discardDraft(draftId);
      repositories.settings.clearRecordDraft();

      // 4. Tell the user what the profile picked up. Undo is offered only for a new record:
      //    an edit replaced the earlier rows, so there is nothing exact left to restore
      //    (ADR-039, ADR-041). Publishing `null` closes a sheet left over from an earlier save.
      const profileAfter = readProfile(repositories, profileRequest);
      publishProfileChange(
        buildProfileChangeReport({
          before: profileBefore,
          after: profileAfter,
          undo: recordId
            ? null
            : undoPlanForRecord(repositories.records.getDetail(personId, targetRecordId)),
          undoUnavailable: recordId ? 'edit' : null,
        }),
      );

      refresh();
      if (recordId) router.back();
      // Show the saved record rather than dropping the user back on Home: they just spent a
      // minute typing it, and this is the moment to confirm it landed.
      else router.replace(`/record/${targetRecordId}`);
    } finally {
      setBusy(false);
    }
  });

  if (missing) {
    return (
      <AppScreen title={strings.recordDetail.title} onBack={() => router.back()}>
        <AppEmptyState title={strings.recordDetail.missing} />
      </AppScreen>
    );
  }

  return (
    <AppScreen
      title={recordId ? strings.recordForm.editTitle : strings.recordForm.newTitle}
      onBack={() => (dirty ? setLeaveOpen(true) : router.back())}
      scroll={false}
      safeAreaBottom
      testID="screen-record-form"
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {banner ? <AppBanner tone="info" message={banner} testID="form-banner" /> : null}

        <RecordBasicsFields
          control={control}
          kind={values.kind}
          onChangeKind={onChangeKind}
          doctorSuggestions={doctors.data?.slice(0, 3).map((doctor) => doctor.name)}
        />

        <MedicationsRepeater control={control} />
        <ReadingsRepeater control={control} />
        <VitalsFields control={control} unitSystem={unitSystem} />

        <AttachmentSection
          title={strings.attachments.prescriptionSection}
          hint={strings.attachments.prescriptionHint}
          items={itemsFor(['prescription'])}
          actions={prescriptionActions}
          onPick={(action) => void pick(action)}
          onRemove={removeAttachment}
          busy={busy}
          limitReached={atLimit}
          count={total}
          max={MAX}
          testID="section-prescription"
        >
          <Controller
            control={control}
            name="prescriptionText"
            render={({ field }) => (
              <AppField
                label={strings.attachments.prescriptionTextLabel}
                value={field.value}
                onChangeText={field.onChange}
                multiline
                numberOfLines={3}
                testID="form-prescription"
              />
            )}
          />
        </AttachmentSection>

        <AttachmentSection
          title={strings.attachments.reportsSection}
          hint={strings.attachments.reportsHint}
          items={itemsFor(['lab_report', 'other'])}
          actions={reportActions}
          onPick={(action) => void pick(action)}
          onRemove={removeAttachment}
          busy={busy}
          limitReached={atLimit}
          count={total}
          max={MAX}
          testID="section-reports"
        />

        <Controller
          control={control}
          name="comments"
          render={({ field }) => (
            <AppField
              label={strings.recordForm.comments}
              value={field.value}
              onChangeText={field.onChange}
              multiline
              numberOfLines={3}
              testID="form-comments"
            />
          )}
        />

        <AppText variant="caption" color="muted">
          {strings.app.disclaimer}
        </AppText>
      </ScrollView>

      <View style={styles.footer}>
        <AppButton
          label={strings.common.save}
          onPress={() => void onSubmit()}
          loading={busy}
          fullWidth
          testID="save-record"
        />
      </View>

      <AppDialog
        visible={leaveOpen}
        title={strings.recordForm.unsavedTitle}
        message={strings.recordForm.unsavedBody}
        confirmLabel={strings.recordForm.unsavedLeave}
        cancelLabel={strings.recordForm.unsavedStay}
        destructive
        onConfirm={() => {
          // The draft is gone, so its staged files are unreachable: delete them with it.
          void getAttachmentService().discardDraft(draftId);
          requireRepositories().settings.clearRecordDraft();
          setLeaveOpen(false);
          router.back();
        }}
        onCancel={() => setLeaveOpen(false)}
        testID="leave-dialog"
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  footer: { paddingTop: spacing.md },
});
