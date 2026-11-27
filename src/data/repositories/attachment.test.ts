/**
 * @jest-environment node
 */
import { createRepositoryFixture, recordInput } from '../testing/repositoryFixture';
import type { AttachmentInput } from './attachmentRepository';

function attachmentInput(overrides: Partial<AttachmentInput> = {}): AttachmentInput {
  return {
    id: 'a1',
    role: 'prescription',
    mime: 'image/jpeg',
    relPath: 'attachments/p/r/a1.jpg',
    thumbRelPath: 'thumbs/a1.jpg',
    bytes: 1_234,
    sha256: 'a'.repeat(64),
    ...overrides,
  };
}

describe('attachmentRepository', () => {
  it('writes attachments in the record transaction and reads them back in order', () => {
    const fixture = createRepositoryFixture();
    const created = fixture.repos.records.create(
      fixture.personId,
      recordInput({
        id: 'r1',
        attachments: [
          attachmentInput({ id: 'a1', relPath: 'attachments/p/r1/a1.jpg' }),
          attachmentInput({
            id: 'a2',
            role: 'lab_report',
            mime: 'application/pdf',
            relPath: 'attachments/p/r1/a2.pdf',
            thumbRelPath: 'thumbs/a2.jpg',
          }),
        ],
      }),
    );

    expect(created.ok).toBe(true);
    const detail = fixture.repos.records.getDetail(fixture.personId, 'r1');
    expect(detail?.attachments.map((row) => [row.id, row.role, row.thumbRelPath])).toEqual([
      ['a1', 'prescription', 'thumbs/a1.jpg'],
      ['a2', 'lab_report', 'thumbs/a2.jpg'],
    ]);
    expect(detail?.attachments[1]?.sha256).toBe('a'.repeat(64));
    fixture.close();
  });

  it('rolls the record back when an attachment row cannot be written', () => {
    const fixture = createRepositoryFixture();
    // Two rows with the same id: the second insert violates the primary key mid-transaction.
    const created = fixture.repos.records.create(
      fixture.personId,
      recordInput({
        id: 'r1',
        attachments: [attachmentInput({ id: 'a1' }), attachmentInput({ id: 'a1' })],
      }),
    );

    expect(created.ok).toBe(false);
    expect(fixture.repos.records.getDetail(fixture.personId, 'r1')).toBeNull();
    expect(fixture.repos.attachments.listAll()).toHaveLength(0);
    fixture.close();
  });

  it('returns the files to delete when a record is removed, and cascades the rows', () => {
    const fixture = createRepositoryFixture();
    fixture.repos.records.create(
      fixture.personId,
      recordInput({
        id: 'r1',
        attachments: [
          attachmentInput({ id: 'a1', relPath: 'attachments/p/r1/a1.jpg' }),
          attachmentInput({
            id: 'a2',
            relPath: 'attachments/p/r1/a2.pdf',
            thumbRelPath: null,
          }),
        ],
      }),
    );

    const removed = fixture.repos.records.remove(fixture.personId, 'r1');

    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    expect([...removed.value.attachmentPaths].sort()).toEqual([
      'attachments/p/r1/a1.jpg',
      'attachments/p/r1/a2.pdf',
      'thumbs/a1.jpg',
    ]);
    expect(fixture.repos.attachments.listAll()).toHaveLength(0);
    fixture.close();
  });

  it('deletes only the attachments the edit removed and keeps the others', () => {
    const fixture = createRepositoryFixture();
    fixture.repos.records.create(
      fixture.personId,
      recordInput({
        id: 'r1',
        attachments: [
          attachmentInput({ id: 'a1' }),
          attachmentInput({ id: 'a2', relPath: 'attachments/p/r1/a2.jpg' }),
        ],
      }),
    );

    const updated = fixture.repos.records.update(
      fixture.personId,
      'r1',
      recordInput({
        removedAttachmentIds: ['a1'],
        attachments: [attachmentInput({ id: 'a3', relPath: 'attachments/p/r1/a3.jpg' })],
      }),
    );

    expect(updated.ok).toBe(true);
    const ids = fixture.repos.records
      .getDetail(fixture.personId, 'r1')
      ?.attachments.map((row) => row.id);
    expect(ids).toEqual(['a2', 'a3']);
    fixture.close();
  });

  it('cannot delete an attachment that belongs to another record', () => {
    const fixture = createRepositoryFixture();
    fixture.repos.records.create(
      fixture.personId,
      recordInput({ id: 'r1', attachments: [attachmentInput({ id: 'a1' })] }),
    );
    fixture.repos.records.create(fixture.personId, recordInput({ id: 'r2' }));

    const removed = fixture.repos.attachments.removeMany('r2', ['a1']);

    expect(removed.ok && removed.value).toEqual([]);
    expect(fixture.repos.attachments.getById('a1')).not.toBeNull();
    fixture.close();
  });

  it('creates an attachment standalone for a later phase', () => {
    const fixture = createRepositoryFixture();
    fixture.repos.records.create(fixture.personId, recordInput({ id: 'r1' }));

    const created = fixture.repos.attachments.create('r1', [
      attachmentInput({ id: 'a9', relPath: 'attachments/p/r1/a9.jpg' }),
    ]);

    expect(created.ok).toBe(true);
    expect(fixture.repos.attachments.listByRecord('r1').map((row) => row.id)).toEqual(['a9']);
    fixture.close();
  });
});
