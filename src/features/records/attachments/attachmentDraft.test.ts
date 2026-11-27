import { MAX_ATTACHMENTS_PER_RECORD } from '@/domain';

import { parseStagedAttachments } from './attachmentDraft';

function staged(overrides: Record<string, unknown> = {}) {
  return {
    id: 'a1',
    draftId: 'd1',
    role: 'prescription',
    mime: 'image/jpeg',
    sha256: 'a'.repeat(64),
    bytes: 1024,
    stagedRelPath: 'staging/d1/a1.jpg',
    stagedThumbRelPath: 'staging/d1/thumbs/a1.jpg',
    ...overrides,
  };
}

describe('parseStagedAttachments', () => {
  it('keeps a well-formed staged attachment', () => {
    expect(parseStagedAttachments([staged()])).toHaveLength(1);
  });

  it('drops an attachment whose path points outside its own staging folder', () => {
    const parsed = parseStagedAttachments([
      staged({ stagedRelPath: 'attachments/p1/r1/a1.jpg' }),
      staged({ id: 'a2', stagedRelPath: '../elsewhere.jpg' }),
    ]);

    expect(parsed).toEqual([]);
  });

  it('drops an unknown role, a short checksum and a non-array payload', () => {
    expect(parseStagedAttachments([staged({ role: 'receipt' })])).toEqual([]);
    expect(parseStagedAttachments([staged({ sha256: 'abc' })])).toEqual([]);
    expect(parseStagedAttachments({ attachments: [] })).toEqual([]);
    expect(parseStagedAttachments(null)).toEqual([]);
  });

  it('never restores more attachments than the per-record cap', () => {
    const many = Array.from({ length: MAX_ATTACHMENTS_PER_RECORD + 5 }, (_, index) =>
      staged({
        id: `a${index}`,
        stagedRelPath: `staging/d1/a${index}.jpg`,
        stagedThumbRelPath: `staging/d1/thumbs/a${index}.jpg`,
      }),
    );

    expect(parseStagedAttachments(many)).toHaveLength(MAX_ATTACHMENTS_PER_RECORD);
  });
});
