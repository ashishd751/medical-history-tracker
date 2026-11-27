/**
 * @jest-environment node
 */
import { createRepositoryFixture, recordInput } from '@/data/testing/repositoryFixture';
import {
  createFakeExportFiles,
  createFakeFileSharer,
  createFakePdfPrinter,
} from '@/platform/testing/fakes';
import { strings } from '@/ui';

import { type ExportRequest, generateAndShareExport } from './exportService';

function harness() {
  const fixture = createRepositoryFixture();
  const printer = createFakePdfPrinter({ pages: 2 });
  const files = createFakeExportFiles(['medical-history-old-20260101.pdf']);
  const sharer = createFakeFileSharer();
  let clock = 1_000;
  const deps = {
    repositories: fixture.repos,
    printer,
    files,
    sharer,
    now: () => {
      clock += 10;
      return clock;
    },
  };
  return { fixture, printer, files, sharer, deps };
}

function request(overrides: Partial<ExportRequest> = {}): ExportRequest {
  return {
    personId: '',
    personName: 'Synthetic Person',
    filter: {},
    columns: ['date', 'symptoms', 'doctor', 'condition', 'readings', 'comments'],
    sortOrder: 'newest',
    today: '2026-11-27',
    ...overrides,
  };
}

describe('generateAndShareExport', () => {
  it('prints an A4 portrait PDF, names it and opens the share sheet', async () => {
    const { fixture, printer, files, sharer, deps } = harness();
    fixture.repos.records.create(
      fixture.personId,
      recordInput({ date: '2026-11-02', symptoms: ['headache'] }),
    );
    fixture.repos.records.create(
      fixture.personId,
      recordInput({ date: '2026-01-05', kind: 'lab_test', symptoms: ['cough'] }),
    );

    const result = await generateAndShareExport(deps, request({ personId: fixture.personId }));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.detail);
    expect(result.value.recordCount).toBe(2);
    expect(result.value.pages).toBe(2);
    expect(result.value.shared).toBe(true);
    expect(result.value.fileName).toBe('medical-history-synthetic-person-20261127.pdf');
    expect(result.value.elapsedMs).toBeGreaterThan(0);

    expect(printer.calls).toHaveLength(1);
    // FR-10's rule is "portrait with up to 5 columns, landscape beyond that", and the default set
    // has six columns, so the default export is landscape (flagged in the progress file).
    expect(printer.calls[0]?.width).toBe(842);
    expect(printer.calls[0]?.height).toBe(595);
    expect(printer.calls[0]?.html).toContain('A4 landscape');
    expect(printer.calls[0]?.html).toContain('Synthetic Person');
    expect(printer.calls[0]?.html).toContain('02/11/2026');
    expect(printer.calls[0]?.html).toContain('05/01/2026');
    expect(printer.calls[0]?.html).toContain(strings.export.column.readings);

    // The old export is gone, the new one carries a meaningful name.
    expect(files.cleared).toBe(1);
    expect(files.files).toEqual([result.value.fileName]);
    expect(files.adopted[0]?.fileName).toBe(result.value.fileName);
    expect(sharer.calls).toEqual([{ uri: result.value.uri, mimeType: 'application/pdf' }]);
    fixture.close();
  });

  it('puts the newest record first, and flips when asked', async () => {
    const { fixture, deps, printer } = harness();
    fixture.repos.records.create(fixture.personId, recordInput({ date: '2026-01-05' }));
    fixture.repos.records.create(fixture.personId, recordInput({ date: '2026-11-02' }));

    await generateAndShareExport(deps, request({ personId: fixture.personId }));
    const newest = printer.calls[0]?.html ?? '';
    expect(newest.indexOf('02/11/2026')).toBeLessThan(newest.indexOf('05/01/2026'));

    await generateAndShareExport(
      deps,
      request({ personId: fixture.personId, sortOrder: 'oldest' }),
    );
    const oldest = printer.calls[1]?.html ?? '';
    expect(oldest.indexOf('05/01/2026')).toBeLessThan(oldest.indexOf('02/11/2026'));
    fixture.close();
  });

  it('switches the page to landscape past five columns', async () => {
    const { fixture, deps, printer } = harness();
    fixture.repos.records.create(fixture.personId, recordInput());

    await generateAndShareExport(
      deps,
      request({
        personId: fixture.personId,
        columns: ['date', 'title', 'type', 'symptoms', 'doctor', 'medications'],
      }),
    );

    expect(printer.calls[0]?.width).toBe(842);
    expect(printer.calls[0]?.height).toBe(595);
    expect(printer.calls[0]?.html).toContain('A4 landscape');
    fixture.close();
  });

  it('applies the date range and the type filter', async () => {
    const { fixture, deps, printer } = harness();
    fixture.repos.records.create(fixture.personId, recordInput({ date: '2026-01-05' }));
    fixture.repos.records.create(
      fixture.personId,
      recordInput({ date: '2026-11-02', kind: 'lab_test' }),
    );

    const result = await generateAndShareExport(
      deps,
      request({ personId: fixture.personId, filter: { from: '2026-06-01' } }),
    );
    expect(result.ok && result.value.recordCount).toBe(1);
    expect(printer.calls[0]?.html).toContain('02/11/2026');
    expect(printer.calls[0]?.html).not.toContain('05/01/2026');

    await generateAndShareExport(
      deps,
      request({ personId: fixture.personId, filter: { kinds: ['doctor_visit'] } }),
    );
    expect(printer.calls[1]?.html).toContain('05/01/2026');
    expect(printer.calls[1]?.html).not.toContain('02/11/2026');
    fixture.close();
  });

  it('writes the header in the user’s units', async () => {
    const { fixture, deps, printer } = harness();
    fixture.repos.settings.updateSettings({ unitSystem: 'imperial' });
    fixture.repos.measurements.create(fixture.personId, {
      kind: 'weight',
      v1: 70,
      v2: null,
      measuredOn: '2026-11-01',
    });
    fixture.repos.records.create(fixture.personId, recordInput());

    await generateAndShareExport(deps, request({ personId: fixture.personId }));

    expect(printer.calls[0]?.html).toContain('154.3 lb');
    expect(printer.calls[0]?.html).not.toContain('70 kg');
    fixture.close();
  });

  it('uses portrait for five columns', async () => {
    const { fixture, deps, printer } = harness();
    fixture.repos.records.create(fixture.personId, recordInput());

    await generateAndShareExport(
      deps,
      request({
        personId: fixture.personId,
        columns: ['date', 'title', 'type', 'symptoms', 'comments'],
      }),
    );

    expect(printer.calls[0]?.width).toBe(595);
    expect(printer.calls[0]?.height).toBe(842);
    expect(printer.calls[0]?.html).toContain('A4 portrait');
    fixture.close();
  });
});

describe('generateAndShareExport failures', () => {
  it('refuses to build an empty PDF and prints nothing', async () => {
    const { fixture, deps, printer, files, sharer } = harness();
    const result = await generateAndShareExport(deps, request({ personId: fixture.personId }));

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected a failure');
    expect(result.error.code).toBe('VALIDATION_FAILED');
    expect(printer.calls).toHaveLength(0);
    expect(files.cleared).toBe(0);
    expect(sharer.calls).toHaveLength(0);
    fixture.close();
  });

  it('maps a print failure to a friendly error and shares nothing', async () => {
    const { fixture, deps, printer, files, sharer } = harness();
    fixture.repos.records.create(fixture.personId, recordInput());
    printer.fail = true;

    const result = await generateAndShareExport(deps, request({ personId: fixture.personId }));

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected a failure');
    expect(result.error.code).toBe('EXPORT_FAILED');
    expect(files.adopted).toHaveLength(0);
    expect(sharer.calls).toHaveLength(0);
    fixture.close();
  });

  it('maps a file-move failure to a friendly error', async () => {
    const { fixture, deps, files, sharer } = harness();
    fixture.repos.records.create(fixture.personId, recordInput());
    files.fail = true;

    const result = await generateAndShareExport(deps, request({ personId: fixture.personId }));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected a failure');
    expect(result.error.code).toBe('EXPORT_FAILED');
    expect(sharer.calls).toHaveLength(0);
    fixture.close();
  });

  it('keeps the file and reports shared:false when there is no share sheet', async () => {
    const { fixture, deps, sharer, files } = harness();
    fixture.repos.records.create(fixture.personId, recordInput());
    sharer.available = false;

    const result = await generateAndShareExport(deps, request({ personId: fixture.personId }));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.detail);
    expect(result.value.shared).toBe(false);
    expect(files.files).toHaveLength(1);
    fixture.close();
  });

  it('fails cleanly for a person that does not exist', async () => {
    const { deps, printer } = harness();
    const result = await generateAndShareExport(deps, request({ personId: 'missing' }));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected a failure');
    expect(result.error.code).toBe('EXPORT_FAILED');
    expect(printer.calls).toHaveLength(0);
  });
});

describe('generateAndShareExport content', () => {
  it('escapes hostile text rather than embedding it', async () => {
    const { fixture, deps, printer } = harness();
    fixture.repos.records.create(
      fixture.personId,
      recordInput({ symptoms: ['<script>alert("x")</script>'], comments: 'a & b' }),
    );

    await generateAndShareExport(deps, request({ personId: fixture.personId }));
    const html = printer.calls[0]?.html ?? '';
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    expect(html).toContain('a &amp; b');
    fixture.close();
  });

  it('includes the profile header, the range and the disclaimer', async () => {
    const { fixture, deps, printer } = harness();
    fixture.repos.records.create(fixture.personId, recordInput({ date: '2026-11-02' }));

    await generateAndShareExport(
      deps,
      request({ personId: fixture.personId, filter: { from: '2026-01-01' } }),
    );
    const html = printer.calls[0]?.html ?? '';
    expect(html).toContain(strings.export.factAge);
    expect(html).toContain(strings.common.notRecorded);
    expect(html).toContain(strings.common.none);
    expect(html).toContain(strings.app.disclaimer);
    expect(html).toContain('Exported on 27/11/2026');
    expect(html).toContain('from 01/01/2026');
    fixture.close();
  });

  it('renders Devanagari and emoji through to the HTML', async () => {
    const { fixture, deps, printer } = harness();
    fixture.repos.records.create(
      fixture.personId,
      recordInput({ symptoms: ['सिरदर्द 🩺'], comments: 'ठीक है' }),
    );

    await generateAndShareExport(deps, request({ personId: fixture.personId }));
    const html = printer.calls[0]?.html ?? '';
    expect(html).toContain('सिरदर्द 🩺');
    expect(html).toContain('ठीक है');
    fixture.close();
  });
});
