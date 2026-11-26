import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { AttachmentRole } from '@/domain';
import { AppButton, AppText, spacing, strings } from '@/ui';

import { AttachmentGrid, type AttachmentGridItem } from './AttachmentGrid';

export interface AttachmentAction {
  readonly label: string;
  readonly source: 'photo' | 'file';
  readonly role: AttachmentRole;
}

export interface AttachmentSectionProps {
  readonly title: string;
  readonly hint: string;
  readonly items: readonly AttachmentGridItem[];
  readonly actions: readonly AttachmentAction[];
  readonly onPick: (action: AttachmentAction) => void;
  readonly onRemove: (id: string) => void;
  /** A picker or the pipeline is running. */
  readonly busy: boolean;
  /** The per-record cap has been reached. */
  readonly limitReached: boolean;
  /** Total attachments on the record, for the counter line. */
  readonly count: number;
  readonly max: number;
  /** Extra fields that belong to this section, e.g. the typed prescription text. */
  readonly children?: ReactNode;
  readonly testID?: string;
}

/**
 * One attachment section of the record form.
 *
 * A section is purely presentational: the screen owns the staged list, the pickers and the save
 * ordering, so both sections share one behaviour.
 */
export function AttachmentSection({
  title,
  hint,
  items,
  actions,
  onPick,
  onRemove,
  busy,
  limitReached,
  count,
  max,
  children,
  testID,
}: AttachmentSectionProps) {
  return (
    <View style={styles.section} testID={testID}>
      <AppText variant="title">{title}</AppText>
      <AppText variant="caption" color="muted">
        {hint}
      </AppText>

      <View style={styles.actions}>
        {actions.map((action) => (
          <AppButton
            key={`${action.source}-${action.role}`}
            label={action.label}
            variant="secondary"
            disabled={busy || limitReached}
            onPress={() => onPick(action)}
            testID={`add-${action.source}-${action.role}`}
          />
        ))}
      </View>

      {busy ? (
        <AppText variant="caption" color="muted">
          {strings.attachments.preparing}
        </AppText>
      ) : null}

      {items.length > 0 ? (
        <AttachmentGrid items={items} onRemove={onRemove} testID={`${testID}-grid`} />
      ) : null}

      {children}

      <AppText variant="caption" color="muted">
        {limitReached
          ? strings.attachments.limitReached(max)
          : strings.attachments.count(count, max)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
