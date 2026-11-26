/**
 * Attachment rules that do not need a device: MIME handling, storage paths and limit checks.
 *
 * Paths are always **relative to the app's documents directory**. The database stores these
 * strings, and `FileStore` resolves them; an absolute URI must never reach SQLite, because a
 * container path changes when iOS reinstalls the app or when a backup is restored on a new phone
 * (ADR-030).
 */
import { MAX_ATTACHMENTS_PER_RECORD, MAX_IMAGE_SOURCE_BYTES, MAX_PDF_BYTES } from './limits';
import { ATTACHMENT_ROLES, type AttachmentRole } from './vocabulary';

/** Everything the pipeline will store, and nothing else. */
export const ATTACHMENT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
  'application/pdf',
] as const;

export type AttachmentMime = (typeof ATTACHMENT_MIME_TYPES)[number];

const EXTENSION_BY_MIME: Record<AttachmentMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

const MIME_BY_EXTENSION: Record<string, AttachmentMime> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  heif: 'image/heif',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

/** Android spellings that name the same formats. */
const MIME_ALIASES: Record<string, AttachmentMime> = {
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'image/x-png': 'image/png',
};

export function isAttachmentMime(value: string): value is AttachmentMime {
  return (ATTACHMENT_MIME_TYPES as readonly string[]).includes(value);
}

/** The stored MIME type, or null when the app must not accept the file. */
export function normalizeMime(mime: string): AttachmentMime | null {
  const lower = mime.trim().toLowerCase();
  if (isAttachmentMime(lower)) return lower;
  return MIME_ALIASES[lower] ?? null;
}

/** `report.PDF` → `pdf`. Empty when the name has no extension. */
export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  if (dot <= 0 || dot === name.length - 1) return '';
  return name.slice(dot + 1).toLowerCase();
}

export function mimeForFileName(name: string): AttachmentMime | null {
  return MIME_BY_EXTENSION[extensionOf(name)] ?? null;
}

/**
 * The MIME type to trust for a picked file.
 *
 * Android providers sometimes report `application/octet-stream` and the photo picker can leave the
 * type empty, so a reported type is used only when it is supported; otherwise the name decides.
 * A file whose name lies about its type (a PDF renamed `.jpg`) is caught later, when the parser
 * rejects it.
 */
export function resolveMime(reported: string, name: string): AttachmentMime | null {
  return normalizeMime(reported) ?? mimeForFileName(name);
}

export function extensionForMime(mime: AttachmentMime): string {
  return EXTENSION_BY_MIME[mime];
}

export function isPdf(mime: string): boolean {
  return normalizeMime(mime) === 'application/pdf';
}

/**
 * PNG and WebP may carry an alpha channel, and a JPEG encoder turns those pixels black. They are
 * flattened onto white before encoding (ADR-031).
 */
export function needsWhiteFlatten(mime: string): boolean {
  const normalized = normalizeMime(mime);
  return normalized === 'image/png' || normalized === 'image/webp';
}

export const ATTACHMENTS_DIR = 'attachments';
export const THUMBS_DIR = 'thumbs';
export const STAGING_DIR = 'staging';

/** A path segment built from an id must not be able to escape its directory. */
export function isSafePathSegment(segment: string): boolean {
  return (
    segment.length > 0 &&
    segment.length <= 128 &&
    !segment.includes('/') &&
    !segment.includes('\\') &&
    !segment.includes(':') &&
    segment !== '.' &&
    segment !== '..'
  );
}

/** A stored path is relative, unless it was written by something that ignored the rule. */
export function isRelativeStoredPath(path: string): boolean {
  return (
    path.length > 0 &&
    !path.startsWith('/') &&
    !path.includes('://') &&
    !path.split('/').includes('..')
  );
}

export function attachmentDir(personId: string, recordId: string): string {
  return `${ATTACHMENTS_DIR}/${personId}/${recordId}`;
}

/** `attachments/<personId>/<recordId>/<attachmentId>.<ext>` */
export function attachmentRelPath(
  personId: string,
  recordId: string,
  attachmentId: string,
  mime: AttachmentMime,
): string {
  return `${attachmentDir(personId, recordId)}/${attachmentId}.${extensionForMime(mime)}`;
}

/** `thumbs/<attachmentId>.jpg` — thumbnails are always JPEG, whatever the source. */
export function thumbRelPath(attachmentId: string): string {
  return `${THUMBS_DIR}/${attachmentId}.jpg`;
}

/** `staging/<draftId>` */
export function stagingDir(draftId: string): string {
  return `${STAGING_DIR}/${draftId}`;
}

/** `staging/<draftId>/<attachmentId>.<ext>` */
export function stagedAttachmentPath(
  draftId: string,
  attachmentId: string,
  mime: AttachmentMime,
): string {
  return `${stagingDir(draftId)}/${attachmentId}.${extensionForMime(mime)}`;
}

/** `staging/<draftId>/thumbs/<attachmentId>.jpg` */
export function stagedThumbPath(draftId: string, attachmentId: string): string {
  return `${stagingDir(draftId)}/${THUMBS_DIR}/${attachmentId}.jpg`;
}

/** Every role, in the order the record screen shows them. */
export const ATTACHMENT_ROLE_ORDER: readonly AttachmentRole[] = ATTACHMENT_ROLES;

/** Why a picked file was refused. Mapped to a friendly sentence by the feature layer. */
export type AttachmentRejection = 'unsupported_type' | 'too_large' | 'too_many';

/**
 * The pre-flight check, before anything is copied or decoded.
 *
 * `bytes` is 0 when the picker did not report a size; that is not a rejection, because the real
 * size is measured once the file is staged.
 */
export function rejectionForCandidate(
  candidate: { readonly mime: string; readonly bytes: number },
  currentCount: number,
): AttachmentRejection | null {
  const mime = normalizeMime(candidate.mime);
  if (!mime) return 'unsupported_type';
  if (currentCount >= MAX_ATTACHMENTS_PER_RECORD) return 'too_many';
  if (candidate.bytes > 0 && candidate.bytes > maxSourceBytes(mime)) return 'too_large';
  return null;
}

/** PDFs keep their original bytes; images are re-encoded, so their source cap can be higher. */
export function maxSourceBytes(mime: AttachmentMime): number {
  return isPdf(mime) ? MAX_PDF_BYTES : MAX_IMAGE_SOURCE_BYTES;
}
