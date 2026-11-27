/**
 * The staged attachments that live inside the record draft (ADR-022, ADR-030).
 *
 * A picked file is copied into `staging/<draftId>/` immediately, and the draft records where it
 * is. The form can therefore be abandoned, the app killed, or the phone restarted, and the files
 * are still there when the draft is restored. Nothing is visible to the rest of the app until the
 * record is saved and the files move to `attachments/`.
 */
import { z } from 'zod';

import {
  ATTACHMENT_MIME_TYPES,
  ATTACHMENT_ROLES,
  type AttachmentMime,
  type AttachmentRole,
  isRelativeStoredPath,
  MAX_ATTACHMENTS_PER_RECORD,
  stagingDir,
} from '@/domain';

export interface StagedAttachment {
  /** The id the attachment row will have; the file name is built from it. */
  readonly id: string;
  /** Which draft the staging folder belongs to. */
  readonly draftId: string;
  readonly role: AttachmentRole;
  readonly mime: AttachmentMime;
  readonly sha256: string;
  readonly bytes: number;
  /** `staging/<draftId>/<id>.<ext>` */
  readonly stagedRelPath: string;
  /** `staging/<draftId>/thumbs/<id>.jpg` */
  readonly stagedThumbRelPath: string;
}

const stagedSchema = z
  .object({
    id: z.string().min(1).max(128),
    draftId: z.string().min(1).max(128),
    role: z.enum(ATTACHMENT_ROLES),
    mime: z.enum(ATTACHMENT_MIME_TYPES),
    sha256: z.string().length(64),
    bytes: z.number().int().nonnegative(),
    stagedRelPath: z.string().min(1),
    stagedThumbRelPath: z.string().min(1),
  })
  .refine(
    (value) =>
      isRelativeStoredPath(value.stagedRelPath) &&
      isRelativeStoredPath(value.stagedThumbRelPath) &&
      value.stagedRelPath.startsWith(`${stagingDir(value.draftId)}/`) &&
      value.stagedThumbRelPath.startsWith(`${stagingDir(value.draftId)}/`),
    'A staged path must stay inside its own staging folder',
  );

/**
 * A corrupt or hand-edited draft must never make the form fail: anything unreadable is dropped and
 * the rest is kept.
 */
export function parseStagedAttachments(value: unknown): StagedAttachment[] {
  if (!Array.isArray(value)) return [];
  const attachments: StagedAttachment[] = [];
  for (const candidate of value.slice(0, MAX_ATTACHMENTS_PER_RECORD)) {
    const parsed = stagedSchema.safeParse(candidate);
    if (parsed.success) attachments.push(parsed.data);
  }
  return attachments;
}

/** The staging folder for a draft, for the sweeper and for discard. */
export function draftStagingDir(draftId: string): string {
  return stagingDir(draftId);
}

/** True when an attachment has not been saved into a record yet. */
export function isStaged(attachment: StagedAttachment): boolean {
  return attachment.stagedRelPath.startsWith(`${stagingDir(attachment.draftId)}/`);
}
