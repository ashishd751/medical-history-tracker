/**
 * @jest-environment node
 */
import { createRepositoryFixture } from '../testing/repositoryFixture';
import { MAX_DRAFT_LENGTH } from './settingsRepository';

describe('settingsRepository', () => {
  it('returns the documented defaults on an empty database', () => {
    const fixture = createRepositoryFixture();

    expect(fixture.repos.settings.getSettings()).toEqual({
      unitSystem: 'metric',
      bmiPreset: 'asian',
      activePersonId: null,
      onboardedAt: null,
    });
    expect(fixture.repos.settings.isOnboarded()).toBe(false);
    fixture.close();
  });

  it('round-trips every setting and keeps untouched keys', () => {
    const fixture = createRepositoryFixture();
    const updated = fixture.repos.settings.updateSettings({
      unitSystem: 'imperial',
      bmiPreset: 'who',
      activePersonId: fixture.personId,
      onboardedAt: 1_760_000_000_000,
    });

    expect(updated.ok).toBe(true);
    expect(fixture.repos.settings.getSettings()).toEqual({
      unitSystem: 'imperial',
      bmiPreset: 'who',
      activePersonId: fixture.personId,
      onboardedAt: 1_760_000_000_000,
    });
    expect(fixture.repos.settings.isOnboarded()).toBe(true);

    fixture.repos.settings.updateSettings({ bmiPreset: 'asian' });
    expect(fixture.repos.settings.getSettings().bmiPreset).toBe('asian');
    expect(fixture.repos.settings.getSettings().unitSystem).toBe('imperial');
    fixture.close();
  });

  it('falls back to defaults when a stored value is invalid or unreadable', () => {
    const fixture = createRepositoryFixture();
    fixture.repos.settings.setRaw('settings.unitSystem', JSON.stringify('stones'));
    fixture.repos.settings.setRaw('settings.bmiPreset', 'not-json');
    fixture.repos.settings.setRaw('settings.onboardedAt', JSON.stringify('yesterday'));

    const settings = fixture.repos.settings.getSettings();
    expect(settings.unitSystem).toBe('metric');
    expect(settings.bmiPreset).toBe('asian');
    expect(settings.onboardedAt).toBeNull();
    fixture.close();
  });

  it('stores, reads and clears the record draft', () => {
    const fixture = createRepositoryFixture();
    expect(fixture.repos.settings.getRecordDraft()).toBeNull();

    const draft = JSON.stringify({ title: 'Synthetic draft', date: '2026-11-02' });
    expect(fixture.repos.settings.saveRecordDraft(draft).ok).toBe(true);
    expect(fixture.repos.settings.getRecordDraft()).toBe(draft);

    expect(fixture.repos.settings.clearRecordDraft().ok).toBe(true);
    expect(fixture.repos.settings.getRecordDraft()).toBeNull();
    fixture.close();
  });

  it('refuses a draft larger than the cap', () => {
    const fixture = createRepositoryFixture();
    const oversized = 'x'.repeat(MAX_DRAFT_LENGTH + 1);

    const result = fixture.repos.settings.saveRecordDraft(oversized);

    expect(result.ok).toBe(false);
    expect(fixture.repos.settings.getRecordDraft()).toBeNull();
    fixture.close();
  });

  it('keeps arbitrary keys available for later phases', () => {
    const fixture = createRepositoryFixture();
    expect(fixture.repos.settings.setRaw('phase3.flag', 'on').ok).toBe(true);

    expect(fixture.repos.settings.getRaw('phase3.flag')).toBe('on');
    expect(fixture.repos.settings.getRaw('missing')).toBeNull();
    fixture.close();
  });
});
