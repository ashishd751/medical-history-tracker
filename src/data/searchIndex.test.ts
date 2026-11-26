/**
 * @jest-environment node
 */
import { rebuildSearchIndex } from './searchIndex';
import { createRepositoryFixture, recordInput } from './testing/repositoryFixture';

/** How many rows the FTS index reports for a term. */
function ftsMatches(fixture: ReturnType<typeof createRepositoryFixture>, term: string): number {
  const row = fixture.database.raw
    .prepare('SELECT COUNT(*) AS n FROM record_fts WHERE record_fts MATCH ?')
    .get(term);
  return Number(row?.n ?? -1);
}

describe('record search index maintenance', () => {
  it('rebuilds the index after it has been emptied', () => {
    const fixture = createRepositoryFixture();
    fixture.repos.records.create(
      fixture.personId,
      recordInput({ symptoms: ['synthetic headache'] }),
    );
    expect(ftsMatches(fixture, 'headache')).toBe(1);

    // Simulate a desync: the triggers never ran, so the index has no rows.
    fixture.database.raw.exec("INSERT INTO record_fts(record_fts) VALUES('delete-all')");
    expect(ftsMatches(fixture, 'headache')).toBe(0);

    rebuildSearchIndex(fixture.database.db);

    expect(ftsMatches(fixture, 'headache')).toBe(1);
    expect(
      fixture.repos.records.listSummaries(fixture.personId, { search: 'headache' }),
    ).toHaveLength(1);
    fixture.close();
  });

  it('drops a deleted person’s records from the index through the cascade', () => {
    const fixture = createRepositoryFixture();
    const otherPerson = fixture.addPerson('Synthetic Relative');
    fixture.repos.records.create(
      fixture.personId,
      recordInput({ title: 'Synthetic migraine', symptoms: ['synthetic headache'] }),
    );
    fixture.repos.records.create(
      otherPerson,
      recordInput({ title: 'Synthetic follow-up', symptoms: ['synthetic cough'] }),
    );
    expect(ftsMatches(fixture, 'headache')).toBe(1);

    // ON DELETE CASCADE removes the records; the AFTER DELETE trigger must clear their index rows
    // as well, or a deleted person's symptoms would linger in the database file (R6a).
    expect(fixture.repos.people.remove(fixture.personId).ok).toBe(true);

    expect(ftsMatches(fixture, 'headache')).toBe(0);
    expect(ftsMatches(fixture, 'cough')).toBe(1);
    expect(fixture.repos.records.listSummaries(otherPerson, { search: 'cough' })).toHaveLength(1);
    fixture.close();
  });
});
