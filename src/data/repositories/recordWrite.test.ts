/**
 * @jest-environment node
 */
import { createRepositoryFixture, recordInput } from '../testing/repositoryFixture';
import { createTestDatabase } from '../testing/testDatabase';
import { createRepositories } from './createRepositories';

describe('recordRepository writes', () => {
  it('saves a record and all of its children in one call', () => {
    const fixture = createRepositoryFixture();
    const created = fixture.repos.records.create(
      fixture.personId,
      recordInput({
        symptoms: ['synthetic headache', 'synthetic nausea'],
        medications: [{ name: 'Synthetic Med', dose: '5 mg', frequency: '1-0-1' }],
        readings: [
          {
            name: 'Synthetic Marker',
            value: '4.2',
            unit: 'mg/dL',
            refLow: 1,
            refHigh: 5,
            flag: 'high',
          },
        ],
        vitals: [
          { kind: 'weight', v1: 70 },
          { kind: 'bp', v1: 128, v2: 82 },
        ],
      }),
    );

    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const detail = fixture.repos.records.getDetail(fixture.personId, created.value);
    expect(detail?.record.symptoms).toEqual(['synthetic headache', 'synthetic nausea']);
    expect(detail?.record.title).toBe('Synthetic check-up');
    expect(detail?.medications).toHaveLength(1);
    expect(detail?.medications[0]).toMatchObject({
      name: 'Synthetic Med',
      dose: '5 mg',
      frequency: '1-0-1',
      status: 'ongoing',
      source: 'manual',
      startOn: '2026-11-02',
    });
    expect(detail?.readings[0]).toMatchObject({
      name: 'Synthetic Marker',
      value: '4.2',
      unit: 'mg/dL',
      refLow: 1,
      refHigh: 5,
      flag: 'high',
      numericValue: null,
    });
    // Ordered by kind, and both dated with the record.
    expect(detail?.measurements.map((row) => [row.kind, row.v1, row.v2, row.measuredOn])).toEqual([
      ['bp', 128, 82, '2026-11-02'],
      ['weight', 70, null, '2026-11-02'],
    ]);
    fixture.close();
  });

  it('refuses a record for a person that does not exist', () => {
    const fixture = createRepositoryFixture();
    const created = fixture.repos.records.create('ghost-person', recordInput());

    expect(created.ok).toBe(false);
    expect(fixture.repos.records.count('ghost-person')).toBe(0);
    fixture.close();
  });

  it('rolls back the record when a child insert fails mid-transaction', () => {
    const database = createTestDatabase();
    database.raw.exec(`
      INSERT INTO person (id, name, dob, sex, created_at, updated_at)
        VALUES ('p1', 'Synthetic', '1990-01-01', 'other', 1, 1);
    `);

    // The record takes the first id; both medications get the same id, so the second insert
    // violates the primary key *after* the record and the first medication were written.
    let calls = 0;
    const repos = createRepositories(database.db, {
      now: () => 1,
      newId: () => {
        calls += 1;
        return calls === 1 ? 'record-id' : 'duplicate-medication-id';
      },
    });

    const result = repos.records.create(
      'p1',
      recordInput({ medications: [{ name: 'First' }, { name: 'Second' }] }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('DB_FAILURE');

    const records = database.raw.prepare('SELECT COUNT(*) AS n FROM record').get();
    const medications = database.raw.prepare('SELECT COUNT(*) AS n FROM medication').get();
    expect(Number(records?.n)).toBe(0);
    expect(Number(medications?.n)).toBe(0);
    database.close();
  });

  it('replaces the child rows on update instead of accumulating them', () => {
    const fixture = createRepositoryFixture();
    const created = fixture.repos.records.create(
      fixture.personId,
      recordInput({
        medications: [{ name: 'Old Med' }, { name: 'Dropped Med' }],
        readings: [{ name: 'Old Marker', value: '1' }],
      }),
    );
    if (!created.ok) throw new Error('setup failed');

    const updated = fixture.repos.records.update(
      fixture.personId,
      created.value,
      recordInput({
        title: 'Synthetic follow-up',
        medications: [{ name: 'New Med' }],
        readings: [],
      }),
    );

    expect(updated.ok).toBe(true);
    const detail = fixture.repos.records.getDetail(fixture.personId, created.value);
    expect(detail?.record.title).toBe('Synthetic follow-up');
    expect(detail?.medications.map((row) => row.name)).toEqual(['New Med']);
    expect(detail?.readings).toHaveLength(0);
    fixture.close();
  });

  it("refuses to read, update or delete another person's record", () => {
    const fixture = createRepositoryFixture();
    const otherPerson = fixture.addPerson('Synthetic Relative');
    const created = fixture.repos.records.create(fixture.personId, recordInput());
    if (!created.ok) throw new Error('setup failed');

    expect(fixture.repos.records.getDetail(otherPerson, created.value)).toBeNull();
    expect(fixture.repos.records.update(otherPerson, created.value, recordInput()).ok).toBe(false);
    expect(fixture.repos.records.remove(otherPerson, created.value).ok).toBe(false);
    expect(fixture.repos.records.count(fixture.personId)).toBe(1);
    fixture.close();
  });

  it('deletes the record and every child row with it', () => {
    const fixture = createRepositoryFixture();
    const created = fixture.repos.records.create(
      fixture.personId,
      recordInput({
        medications: [{ name: 'Synthetic Med' }],
        readings: [{ name: 'Synthetic Marker', value: '2' }],
        vitals: [{ kind: 'weight', v1: 70 }],
      }),
    );
    if (!created.ok) throw new Error('setup failed');

    expect(fixture.repos.records.remove(fixture.personId, created.value).ok).toBe(true);

    for (const table of ['record', 'medication', 'test_result', 'measurement']) {
      const row = fixture.database.raw.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get();
      expect({ table, n: Number(row?.n) }).toEqual({ table, n: 0 });
    }
    fixture.close();
  });

  it('keeps the prescription text and the follow-up date', () => {
    const fixture = createRepositoryFixture();
    const created = fixture.repos.records.create(
      fixture.personId,
      recordInput({
        kind: 'procedure',
        facility: 'Synthetic Day Clinic',
        prescriptionText: 'Synthetic prescription',
        followUpOn: '2026-12-01',
      }),
    );
    if (!created.ok) throw new Error('setup failed');

    const detail = fixture.repos.records.getDetail(fixture.personId, created.value);
    expect(detail?.record.prescriptionText).toBe('Synthetic prescription');
    expect(detail?.record.followUpOn).toBe('2026-12-01');
    expect(detail?.record.facility).toBe('Synthetic Day Clinic');
    fixture.close();
  });

  it('reads damaged symptoms as an empty list instead of failing the screen', () => {
    const fixture = createRepositoryFixture();
    const created = fixture.repos.records.create(fixture.personId, recordInput());
    if (!created.ok) throw new Error('setup failed');

    fixture.database.raw
      .prepare("UPDATE record SET symptoms = 'not json' WHERE id = ?")
      .run(created.value);

    const detail = fixture.repos.records.getDetail(fixture.personId, created.value);
    expect(detail?.record.symptoms).toEqual([]);
    fixture.close();
  });
});
