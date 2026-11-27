import { buildExportFileName, exportFileSlug } from './fileName';

describe('exportFileSlug', () => {
  it('lower-cases and hyphenates a Latin name', () => {
    expect(exportFileSlug('Asha Testperson')).toBe('asha-testperson');
    expect(exportFileSlug('ASHA')).toBe('asha');
  });

  it('drops punctuation and collapses runs of separators', () => {
    expect(exportFileSlug("Asha O'Test  Jr.")).toBe('asha-o-test-jr');
    expect(exportFileSlug('  Asha   Testperson  ')).toBe('asha-testperson');
  });

  it('keeps digits', () => {
    expect(exportFileSlug('Person 2')).toBe('person-2');
  });

  it('falls back to "person" for a name with no ASCII form', () => {
    expect(exportFileSlug('सिरदर्द')).toBe('person');
    expect(exportFileSlug('🩺')).toBe('person');
    expect(exportFileSlug('')).toBe('person');
    expect(exportFileSlug('---')).toBe('person');
  });

  it('caps the length so a long name cannot overflow a file system limit', () => {
    const slug = exportFileSlug('a'.repeat(200));
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug).toBe('a'.repeat(40));
  });

  it('never leaves a trailing dash after the cap', () => {
    expect(exportFileSlug(`${'a'.repeat(39)} bc`)).toBe('a'.repeat(39));
  });
});

describe('buildExportFileName', () => {
  it('names the file after the person and the export date', () => {
    expect(buildExportFileName('Asha Testperson', '2026-11-27')).toBe(
      'medical-history-asha-testperson-20261127.pdf',
    );
  });

  it('uses the fallback person slug for a non-Latin name', () => {
    expect(buildExportFileName('सिरदर्द', '2026-11-27')).toBe('medical-history-person-20261127.pdf');
  });

  it('never lets a bad date introduce a path separator or a second extension', () => {
    const name = buildExportFileName('Asha', '../../etc/passwd');
    expect(name).toBe('medical-history-asha-export.pdf');
    expect(name).not.toContain('/');
    expect(name.endsWith('.pdf')).toBe(true);
    expect(name.match(/\.pdf/g)).toHaveLength(1);
  });

  it('accepts a compact date too', () => {
    expect(buildExportFileName('Asha', '20261127')).toBe('medical-history-asha-20261127.pdf');
  });
});
