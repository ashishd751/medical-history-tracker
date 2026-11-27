import {
  attachmentRelPath,
  extensionForMime,
  isRelativeStoredPath,
  isSafePathSegment,
  mimeForFileName,
  needsWhiteFlatten,
  normalizeMime,
  rejectionForCandidate,
  resolveMime,
  stagedAttachmentPath,
  stagedThumbPath,
  thumbRelPath,
} from './attachments';

describe('attachment mime handling', () => {
  it('normalises the spellings Android providers use', () => {
    expect(normalizeMime('IMAGE/JPG')).toBe('image/jpeg');
    expect(normalizeMime('image/x-png')).toBe('image/png');
    expect(normalizeMime('video/mp4')).toBeNull();
  });

  it('resolves a missing reported type from the file name', () => {
    expect(resolveMime('', 'scan.PDF')).toBe('application/pdf');
    expect(resolveMime('application/octet-stream', 'photo.heic')).toBe('image/heic');
    expect(resolveMime('', 'notes.txt')).toBeNull();
  });

  it('maps a mime type to one stored extension', () => {
    expect(extensionForMime('image/jpeg')).toBe('jpg');
    expect(extensionForMime('application/pdf')).toBe('pdf');
  });

  it('falls back to the extension when asking for a mime type', () => {
    expect(mimeForFileName('a.b.c.webp')).toBe('image/webp');
    expect(mimeForFileName('noextension')).toBeNull();
    expect(mimeForFileName('.hidden')).toBeNull();
  });

  it('only flattens formats that can carry alpha', () => {
    expect(needsWhiteFlatten('image/png')).toBe(true);
    expect(needsWhiteFlatten('image/webp')).toBe(true);
    expect(needsWhiteFlatten('image/jpeg')).toBe(false);
    expect(needsWhiteFlatten('application/pdf')).toBe(false);
  });
});

describe('attachment paths', () => {
  it('builds the documented layout', () => {
    expect(attachmentRelPath('p1', 'r1', 'a1', 'image/jpeg')).toBe('attachments/p1/r1/a1.jpg');
    expect(thumbRelPath('a1')).toBe('thumbs/a1.jpg');
    expect(stagedAttachmentPath('d1', 'a1', 'application/pdf')).toBe('staging/d1/a1.pdf');
    expect(stagedThumbPath('d1', 'a1')).toBe('staging/d1/thumbs/a1.jpg');
  });

  it('refuses path segments that could escape the directory', () => {
    expect(isSafePathSegment('0b1c2d3e')).toBe(true);
    expect(isSafePathSegment('..')).toBe(false);
    expect(isSafePathSegment('.')).toBe(false);
    expect(isSafePathSegment('a/b')).toBe(false);
    expect(isSafePathSegment('C:')).toBe(false);
    expect(isSafePathSegment('')).toBe(false);
  });

  it('recognises a relative stored path', () => {
    expect(isRelativeStoredPath('attachments/p1/r1/a1.jpg')).toBe(true);
    expect(isRelativeStoredPath('/var/mobile/a1.jpg')).toBe(false);
    expect(isRelativeStoredPath('file:///a1.jpg')).toBe(false);
    expect(isRelativeStoredPath('attachments/../secrets')).toBe(false);
  });
});

describe('attachment limits', () => {
  it('rejects an unsupported type before anything is copied', () => {
    expect(rejectionForCandidate({ mime: 'text/plain', bytes: 10 }, 0)).toBe('unsupported_type');
  });

  it('rejects a file over the PDF cap but allows a photo of the same size', () => {
    const overPdfCap = 26 * 1024 * 1024;
    expect(rejectionForCandidate({ mime: 'application/pdf', bytes: overPdfCap }, 0)).toBe(
      'too_large',
    );
    expect(rejectionForCandidate({ mime: 'image/jpeg', bytes: overPdfCap }, 0)).toBeNull();
  });

  it('rejects the eleventh attachment', () => {
    expect(rejectionForCandidate({ mime: 'image/jpeg', bytes: 10 }, 9)).toBeNull();
    expect(rejectionForCandidate({ mime: 'image/jpeg', bytes: 10 }, 10)).toBe('too_many');
  });

  it('does not reject when the picker withheld the size', () => {
    expect(rejectionForCandidate({ mime: 'image/png', bytes: 0 }, 0)).toBeNull();
  });
});
