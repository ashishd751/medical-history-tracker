/**
 * The attachment import pipeline (ADR-030, ADR-031, ADR-032).
 *
 * One place owns the sequence: validate → copy into staging → render a thumbnail → hash → move into
 * place on save → delete rows and files in the right order on removal. The screen only decides
 * *which* role an attachment has and shows the messages this module returns.
 *
 * Everything device-facing is injected, so the whole pipeline is exercised in Jest with the
 * in-memory file system and the platform fakes.
 */
import type { AttachmentInput, FileStore, ImportedFile } from '@/data';
import {
  type AttachmentMime,
  type AttachmentRejection,
  attachmentRelPath,
  type AttachmentRole,
  IMAGE_JPEG_QUALITY,
  IMAGE_MAX_LONG_EDGE,
  IMAGE_TARGET_BYTES,
  MAX_ATTACHMENTS_PER_RECORD,
  MAX_PDF_BYTES,
  maxSourceBytes,
  needsWhiteFlatten,
  rejectionForCandidate,
  resolveMime,
  stagedAttachmentPath,
  stagedThumbPath,
  THUMB_MAX_LONG_EDGE,
  thumbRelPath,
} from '@/domain';
import { type AppError, appError } from '@/lib/errors';
import type {
  DocumentPicker,
  ImageLibraryPicker,
  ImageProcessor,
  PdfThumbnailer,
  PickedFile,
  PickOutcome,
} from '@/platform';
import { strings } from '@/ui/strings';

import { draftStagingDir, type StagedAttachment } from './attachmentDraft';

export interface AttachmentPorts {
  readonly images: ImageLibraryPicker;
  readonly documents: DocumentPicker;
  readonly processor: ImageProcessor;
  readonly pdf: PdfThumbnailer;
  readonly files: FileStore;
  readonly newId: () => string;
}

/** A refused file, with the sentence the form should show. */
export interface ImportProblem {
  readonly error: AppError;
  readonly message: string;
}

export type ImportResult =
  | {
      readonly status: 'staged';
      readonly attachments: readonly StagedAttachment[];
      /** True when the photo library granted access to selected photos only. */
      readonly limited: boolean;
      /** Files refused while the rest were staged. */
      readonly problems: readonly ImportProblem[];
    }
  | { readonly status: 'cancelled' }
  | { readonly status: 'denied'; readonly limited: boolean }
  | { readonly status: 'failed'; readonly problem: ImportProblem };

export interface ImportRequest {
  readonly role: AttachmentRole;
  readonly personId: string;
  readonly draftId: string;
  /** Attachments already on the record or in the draft, for the per-record cap. */
  readonly existingCount: number;
}

export interface MoveRequest {
  readonly personId: string;
  readonly recordId: string;
  readonly staged: readonly StagedAttachment[];
}

export interface AttachmentService {
  importFromLibrary(request: ImportRequest): Promise<ImportResult>;
  importFromFiles(request: ImportRequest): Promise<ImportResult>;
  /** Moves staged files to `attachments/…` and returns the rows to write in the record transaction. */
  moveIntoPlace(
    request: MoveRequest,
  ): Promise<
    | { readonly ok: true; readonly inputs: readonly AttachmentInput[] }
    | { readonly ok: false; readonly error: AppError }
  >;
  /** Undo of `moveIntoPlace`, for when the database write fails after the files moved. */
  rollbackToStaging(request: MoveRequest): Promise<void>;
  /** Deletes a staged attachment's files (removed in the form before saving). */
  removeStaged(attachments: readonly StagedAttachment[]): Promise<void>;
  /** Deletes a draft's whole staging folder. */
  discardDraft(draftId: string): Promise<void>;
  /** Deletes stored files after their rows were removed in a committed transaction. */
  deleteFiles(paths: readonly string[]): Promise<void>;
}

/** Progressively harsher encodings, tried until the stored image is under the target size. */
const IMAGE_COMPRESSION_STEPS = [IMAGE_JPEG_QUALITY, 0.6, 0.45] as const;

const MB = 1024 * 1024;

function rejectionProblem(reason: AttachmentRejection, mime: AttachmentMime): ImportProblem {
  switch (reason) {
    case 'unsupported_type':
      return {
        error: appError('UNSUPPORTED_FILE_TYPE', 'Unsupported attachment type.'),
        message: strings.attachments.unsupportedType,
      };
    case 'too_large':
      return {
        error: appError('FILE_TOO_LARGE', `Over the ${maxSourceBytes(mime)} byte cap.`),
        message: strings.attachments.tooLarge(Math.round(maxSourceBytes(mime) / MB)),
      };
    case 'too_many':
      return {
        error: appError('VALIDATION_FAILED', 'Attachment cap reached.'),
        message: strings.attachments.limitReached(MAX_ATTACHMENTS_PER_RECORD),
      };
  }
}

const writeProblem: ImportProblem = {
  error: appError('FILE_WRITE_FAILED', 'Could not write the attachment.'),
  message: strings.attachments.writeFailed,
};

const corruptProblem: ImportProblem = {
  error: appError('FILE_CORRUPT', 'The file could not be decoded.'),
  message: strings.attachments.corrupt,
};

async function stageImage(
  ports: AttachmentPorts,
  file: PickedFile,
  sourceMime: AttachmentMime,
  role: AttachmentRole,
  draftId: string,
): Promise<{ ok: true; attachment: StagedAttachment } | { ok: false; problem: ImportProblem }> {
  const id = ports.newId();
  const relPath = stagedAttachmentPath(draftId, id, 'image/jpeg');

  let imported: ImportedFile | null = null;
  try {
    for (const compress of IMAGE_COMPRESSION_STEPS) {
      const processed = await ports.processor.prepareJpeg({
        uri: file.uri,
        maxLongEdge: IMAGE_MAX_LONG_EDGE,
        compress,
        flattenTransparency: needsWhiteFlatten(sourceMime),
      });
      const written = await ports.files.importFile(processed.uri, relPath);
      if (!written.ok) return { ok: false, problem: writeProblem };
      imported = written.value;
      // Good enough: stop before re-encoding a page that is already small.
      if (written.value.bytes <= IMAGE_TARGET_BYTES) break;
    }
  } catch {
    // A decoder rejection is the corrupt-file case: a PDF renamed .jpg lands here.
    await ports.files.remove(relPath);
    return { ok: false, problem: corruptProblem };
  }

  if (!imported) return { ok: false, problem: corruptProblem };

  let thumbUri: string;
  try {
    // Thumbnail from the stored JPEG, so the sheet shows exactly what was kept.
    const thumb = await ports.processor.prepareJpeg({
      uri: ports.files.toUri(relPath),
      maxLongEdge: THUMB_MAX_LONG_EDGE,
      compress: 0.7,
      flattenTransparency: false,
    });
    thumbUri = thumb.uri;
  } catch {
    await ports.files.remove(relPath);
    return { ok: false, problem: corruptProblem };
  }

  const stagedThumbRelPath = stagedThumbPath(draftId, id);
  const thumbWritten = await ports.files.importFile(thumbUri, stagedThumbRelPath);
  if (!thumbWritten.ok) {
    await ports.files.remove(relPath);
    return { ok: false, problem: writeProblem };
  }

  return {
    ok: true,
    attachment: {
      id,
      draftId,
      role,
      mime: 'image/jpeg',
      sha256: imported.sha256,
      bytes: imported.bytes,
      stagedRelPath: relPath,
      stagedThumbRelPath,
    },
  };
}

async function stagePdf(
  ports: AttachmentPorts,
  file: PickedFile,
  role: AttachmentRole,
  draftId: string,
): Promise<{ ok: true; attachment: StagedAttachment } | { ok: false; problem: ImportProblem }> {
  const id = ports.newId();
  const relPath = stagedAttachmentPath(draftId, id, 'application/pdf');

  const written = await ports.files.importFile(file.uri, relPath);
  if (!written.ok) return { ok: false, problem: writeProblem };

  if (written.value.bytes > MAX_PDF_BYTES) {
    await ports.files.remove(relPath);
    return { ok: false, problem: rejectionProblem('too_large', 'application/pdf') };
  }

  let pageUri: string;
  try {
    // Render from the stored copy: the picker's cache file may already be gone.
    const page = await ports.pdf.renderFirstPage(ports.files.toUri(relPath), THUMB_MAX_LONG_EDGE);
    pageUri = page.uri;
  } catch {
    await ports.files.remove(relPath);
    return { ok: false, problem: corruptProblem };
  }

  const stagedThumbRelPath = stagedThumbPath(draftId, id);
  const thumbWritten = await ports.files.importFile(pageUri, stagedThumbRelPath);
  if (!thumbWritten.ok) {
    await ports.files.remove(relPath);
    return { ok: false, problem: writeProblem };
  }

  return {
    ok: true,
    attachment: {
      id,
      draftId,
      role,
      mime: 'application/pdf',
      sha256: written.value.sha256,
      bytes: written.value.bytes,
      stagedRelPath: relPath,
      stagedThumbRelPath,
    },
  };
}

async function stageOne(
  ports: AttachmentPorts,
  file: PickedFile,
  role: AttachmentRole,
  draftId: string,
): Promise<{ ok: true; attachment: StagedAttachment } | { ok: false; problem: ImportProblem }> {
  const mime = resolveMime(file.mime, file.name);
  if (!mime) return { ok: false, problem: rejectionProblem('unsupported_type', 'image/jpeg') };
  return mime === 'application/pdf'
    ? stagePdf(ports, file, role, draftId)
    : stageImage(ports, file, mime, role, draftId);
}

export function createAttachmentService(ports: AttachmentPorts): AttachmentService {
  const finalPath = (personId: string, recordId: string, staged: StagedAttachment): string =>
    attachmentRelPath(personId, recordId, staged.id, staged.mime);

  const moveBack = async (
    moves: readonly { readonly from: string; readonly to: string }[],
  ): Promise<void> => {
    // Reverse order, so a half-finished move is undone the way it was made.
    for (const move of [...moves].reverse()) {
      await ports.files.move(move.from, move.to);
    }
  };

  const runImport = async (outcome: PickOutcome, request: ImportRequest): Promise<ImportResult> => {
    if (outcome.status === 'cancelled') return { status: 'cancelled' };
    if (outcome.status === 'denied') return { status: 'denied', limited: outcome.limited };
    if (outcome.status === 'failed') {
      return {
        status: 'failed',
        problem: { error: appError('UNKNOWN', outcome.detail), message: strings.errors.unknown },
      };
    }

    const attachments: StagedAttachment[] = [];
    const problems: ImportProblem[] = [];

    for (const file of outcome.files) {
      const mime = resolveMime(file.mime, file.name);
      const rejection = rejectionForCandidate(
        { mime: mime ?? file.mime, bytes: file.bytes },
        request.existingCount + attachments.length,
      );
      if (rejection) {
        problems.push(rejectionProblem(rejection, mime ?? 'image/jpeg'));
        continue;
      }
      const staged = await stageOne(ports, file, request.role, request.draftId);
      if (staged.ok) attachments.push(staged.attachment);
      else problems.push(staged.problem);
    }

    return { status: 'staged', attachments, limited: outcome.limited, problems };
  };

  return {
    importFromLibrary: async (request) => runImport(await ports.images.pickImages(), request),
    importFromFiles: async (request) => runImport(await ports.documents.pickDocuments(), request),

    async moveIntoPlace({ personId, recordId, staged }) {
      const moves: { from: string; to: string }[] = [];
      const inputs: AttachmentInput[] = [];

      for (const attachment of staged) {
        const relPath = finalPath(personId, recordId, attachment);
        const thumb = thumbRelPath(attachment.id);

        const movedFile = await ports.files.move(attachment.stagedRelPath, relPath);
        if (!movedFile.ok) {
          await moveBack(moves);
          return movedFile;
        }
        moves.push({ from: relPath, to: attachment.stagedRelPath });

        const movedThumb = await ports.files.move(attachment.stagedThumbRelPath, thumb);
        if (!movedThumb.ok) {
          await moveBack(moves);
          return movedThumb;
        }
        moves.push({ from: thumb, to: attachment.stagedThumbRelPath });

        inputs.push({
          id: attachment.id,
          role: attachment.role,
          mime: attachment.mime,
          relPath,
          thumbRelPath: thumb,
          bytes: attachment.bytes,
          sha256: attachment.sha256,
        });
      }

      return { ok: true, inputs };
    },

    async rollbackToStaging({ personId, recordId, staged }) {
      const moves: { from: string; to: string }[] = [];
      for (const attachment of staged) {
        moves.push({
          from: finalPath(personId, recordId, attachment),
          to: attachment.stagedRelPath,
        });
        moves.push({ from: thumbRelPath(attachment.id), to: attachment.stagedThumbRelPath });
      }
      await moveBack(moves);
    },

    async removeStaged(attachments) {
      await ports.files.removeMany(
        attachments.flatMap((attachment) => [
          attachment.stagedRelPath,
          attachment.stagedThumbRelPath,
        ]),
      );
    },

    async discardDraft(draftId) {
      await ports.files.removeDir(draftStagingDir(draftId));
    },

    async deleteFiles(paths) {
      await ports.files.removeMany(paths);
    },
  };
}
