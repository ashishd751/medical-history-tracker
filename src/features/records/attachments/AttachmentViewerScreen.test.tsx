import { render, screen } from '@testing-library/react-native';

import { SessionProvider, type SessionState } from '@/lib/session';
import { AppThemeProvider } from '@/ui';

import { AttachmentViewerScreen } from './AttachmentViewerScreen';

/**
 * The viewer's data comes from the repositories and the file store. Both are mocked here so the
 * test never opens a database or touches the file system; the real pipeline is covered by
 * `attachmentService.test.ts`, the repositories by SQLite tests, and the viewer on devices (T10).
 */
jest.mock('@/data', () => {
  const row = {
    id: 'a1',
    recordId: 'r1',
    role: 'lab_report',
    mime: 'application/pdf',
    relPath: 'attachments/p1/r1/a1.pdf',
    thumbRelPath: 'thumbs/a1.jpg',
    bytes: 2048,
    sha256: 'a'.repeat(64),
    ocrText: null,
    handwritingLikely: null,
    createdAt: 1,
  };
  return {
    getFileStore: () => ({
      exists: () => true,
      toUri: (path: string) => `file:///docs/${path}`,
    }),
    requireRepositories: () => ({
      attachments: { getById: (id: string) => (id === row.id ? row : null) },
      records: { getDetail: () => ({ record: { id: 'r1' } }) },
    }),
  };
});

const session: SessionState = {
  ready: true,
  error: null,
  personId: 'p1',
  personName: 'Synthetic Person',
  unitSystem: 'metric',
  bmiPreset: 'asian',
  onboarded: true,
  refresh: () => undefined,
};

function renderViewer(attachmentId: string) {
  return render(
    <AppThemeProvider scheme="light">
      <SessionProvider value={session}>
        <AttachmentViewerScreen attachmentId={attachmentId} />
      </SessionProvider>
    </AppThemeProvider>,
  );
}

describe('AttachmentViewerScreen', () => {
  it('shows a PDF as its first page with an Open action', async () => {
    await renderViewer('a1');

    expect(screen.getByTestId('screen-attachment-viewer')).toBeOnTheScreen();
    expect(screen.getByTestId('viewer-pdf-page')).toBeOnTheScreen();
    expect(screen.getByTestId('viewer-open-pdf')).toBeEnabled();
    // A PDF is never rendered in-app, so there is no zoom canvas here.
    expect(screen.queryByTestId('viewer-image')).toBeNull();
  });

  it('says the file is missing when the attachment does not exist', async () => {
    await renderViewer('nope');

    expect(screen.getByText('File missing')).toBeOnTheScreen();
  });
});
