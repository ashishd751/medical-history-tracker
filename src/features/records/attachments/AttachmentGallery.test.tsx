import { fireEvent, render, screen } from '@testing-library/react-native';

import type { AttachmentRow } from '@/data';
import { AppThemeProvider } from '@/ui';

import { AttachmentGallery, groupAttachments } from './AttachmentGallery';

function row(overrides: Partial<AttachmentRow> = {}): AttachmentRow {
  return {
    id: 'a1',
    recordId: 'r1',
    role: 'prescription',
    mime: 'image/jpeg',
    relPath: 'attachments/p1/r1/a1.jpg',
    thumbRelPath: 'thumbs/a1.jpg',
    bytes: 100,
    sha256: 'a'.repeat(64),
    ocrText: null,
    handwritingLikely: null,
    createdAt: 1,
    ...overrides,
  };
}

const files = {
  exists: (path: string) => path.startsWith('thumbs/'),
  toUri: (path: string) => `file:///docs/${path}`,
};

describe('groupAttachments', () => {
  it('groups by role in the documented order', () => {
    const groups = groupAttachments(
      [
        row({ id: 'a1', role: 'other' }),
        row({ id: 'a2', role: 'prescription' }),
        row({ id: 'a3', role: 'lab_report', mime: 'application/pdf' }),
      ],
      files,
    );

    expect(groups.map((group) => [group.role, group.items.map((item) => item.id)])).toEqual([
      ['prescription', ['a2']],
      ['lab_report', ['a3']],
      ['other', ['a1']],
    ]);
  });

  it('marks PDFs as shareable, images as viewer-only', () => {
    const groups = groupAttachments(
      [row({ id: 'a1' }), row({ id: 'a2', mime: 'application/pdf', role: 'lab_report' })],
      files,
    );

    expect(groups[0]?.items[0]?.shareable).toBe(false);
    expect(groups[1]?.items[0]?.shareable).toBe(true);
  });

  it('keeps a row whose thumbnail is missing', () => {
    const groups = groupAttachments([row({ thumbRelPath: null })], files);

    expect(groups[0]?.items).toHaveLength(1);
    expect(groups[0]?.items[0]?.thumbnailUri).toBeNull();
  });
});

describe('AttachmentGallery', () => {
  it('opens a tile and shares a PDF', async () => {
    const onOpen = jest.fn();
    const onShare = jest.fn();
    const groups = groupAttachments(
      [
        row({ id: 'a1' }),
        row({
          id: 'a2',
          role: 'lab_report',
          mime: 'application/pdf',
          thumbRelPath: 'thumbs/a2.jpg',
        }),
      ],
      files,
    );

    await render(
      <AppThemeProvider scheme="light">
        <AttachmentGallery groups={groups} onOpen={onOpen} onShare={onShare} />
      </AppThemeProvider>,
    );

    expect(screen.getByTestId('gallery-prescription')).toBeOnTheScreen();
    expect(screen.getByTestId('gallery-lab_report')).toBeOnTheScreen();
    expect(screen.getByText('PDF')).toBeOnTheScreen();
    expect(screen.getByText('Image')).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId('attachment-tile-a1'));
    expect(onOpen).toHaveBeenCalledWith('a1');

    fireEvent.press(screen.getByTestId('open-attachment-a2'));
    expect(onShare).toHaveBeenCalledWith('a2');
  });

  it('renders nothing when there are no attachments', async () => {
    await render(
      <AppThemeProvider scheme="light">
        <AttachmentGallery
          groups={groupAttachments([], files)}
          onOpen={jest.fn()}
          onShare={jest.fn()}
          testID="gallery"
        />
      </AppThemeProvider>,
    );

    expect(screen.queryByTestId('gallery')).toBeNull();
  });
});
