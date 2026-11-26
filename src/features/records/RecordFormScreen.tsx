import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native';

import { requireRepositories } from '@/data';
import { FACILITY_KINDS, type RecordKind } from '@/domain';
import { useSession } from '@/lib/session';
import {
  AppBanner,
  AppButton,
  AppDialog,
  AppEmptyState,
  AppField,
  AppScreen,
  AppText,
  spacing,
  strings,
} from '@/ui';

import { MedicationsRepeater } from './form/MedicationsRepeater';
import { ReadingsRepeater } from './form/ReadingsRepeater';
import { RecordBasicsFields } from './form/RecordBasicsFields';
import { VitalsFields } from './form/VitalsFields';
import { emptyForm, parseDraft, toFormValues, toRecordInput } from './recordFormMapping';
import { createRecordFormSchema, type RecordFormValues } from './recordFormSchema';

/**
 * Create or edit a record.
 *
 * The record, its medications, its readings and its vitals are one form and one transaction.
 * The draft is written to `app_setting` while typing (ADR-022) and leaving with unsaved changes
 * asks first.
 */
export function RecordFormScreen({ recordId }: { recordId?: string }) {
  const { personId, unitSystem, refresh } = useSession();
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

  const bootstrap = useMemo<{ values: RecordFormValues; fromDraft: boolean }>(() => {
    if (detail) {
      const doctor = detail.record.doctorId
        ? requireRepositories().doctors.getById(detail.record.doctorId)
        : null;
      return { values: toFormValues(detail, unitSystem, doctor?.name ?? ''), fromDraft: false };
    }
    if (recordId) return { values: emptyForm(), fromDraft: false };
    const draft = parseDraft(requireRepositories().settings.getRecordDraft());
    return draft && draft.recordId === null
      ? { values: draft.values, fromDraft: true }
      : { values: emptyForm(), fromDraft: false };
  }, [detail, recordId, unitSystem]);

  const doctors = useQuery({
    queryKey: ['doctors'],
    queryFn: () => requireRepositories().doctors.list(),
  });

  const {
    control,
    handleSubmit,
    setValue,
    formState: { isDirty, isSubmitting },
  } = useForm<RecordFormValues>({
    resolver: zodResolver(schema),
    defaultValues: bootstrap.values,
    mode: 'onBlur',
  });

  const [leaveOpen, setLeaveOpen] = useState(false);
  const [banner, setBanner] = useState<string | null>(
    bootstrap.fromDraft ? strings.recordForm.draftRestored : null,
  );

  // Android's hardware back must respect the same guard as the header button; without this a
  // back press silently discards a half-typed record.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!isDirty) return false;
      setLeaveOpen(true);
      return true;
    });
    return () => subscription.remove();
  }, [isDirty]);

  // `useWatch` rather than `watch()`: the compiler-aware lint rule rejects `watch()`, and this
  // subscribes to the whole form so the draft can be saved while typing.
  const values = useWatch({ control }) as RecordFormValues;

  useEffect(() => {
    // Only a user edit is worth keeping; opening a record must not overwrite a newer draft.
    if (!isDirty) return;
    const timer = setTimeout(() => {
      requireRepositories().settings.saveRecordDraft(
        JSON.stringify({ recordId: recordId ?? null, values }),
      );
    }, 400);
    return () => clearTimeout(timer);
  }, [values, isDirty, recordId]);

  const onChangeKind = (kind: RecordKind) => {
    setValue('kind', kind, { shouldDirty: true });
    if (!FACILITY_KINDS.includes(kind)) setValue('facility', '', { shouldDirty: true });
  };

  const onSubmit = handleSubmit((formValues) => {
    if (!personId) return;
    const repositories = requireRepositories();

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

    const input = { ...toRecordInput(formValues, unitSystem), doctorId };

    if (recordId) {
      const updated = repositories.records.update(personId, recordId, input);
      if (!updated.ok) {
        setBanner(strings.recordForm.saveFailed);
        return;
      }
      repositories.settings.clearRecordDraft();
      refresh();
      router.back();
      return;
    }

    const created = repositories.records.create(personId, input);
    if (!created.ok) {
      setBanner(strings.recordForm.saveFailed);
      return;
    }
    repositories.settings.clearRecordDraft();
    refresh();
    // Show the saved record rather than dropping the user back on Home: they just spent a
    // minute typing it, and this is the moment to confirm it landed.
    router.replace(`/record/${created.value}`);
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
      onBack={() => (isDirty ? setLeaveOpen(true) : router.back())}
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

        <Controller
          control={control}
          name="prescriptionText"
          render={({ field }) => (
            <AppField
              label={strings.recordForm.prescription}
              value={field.value}
              onChangeText={field.onChange}
              multiline
              numberOfLines={3}
              testID="form-prescription"
            />
          )}
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
          loading={isSubmitting}
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
