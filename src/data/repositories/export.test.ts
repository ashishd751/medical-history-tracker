import { measurement, record, testResult } from '../schema';
import { createRepositoryFixture, recordInput } from '../testing/repositoryFixture';
import { EXPORT_QUERY_CHUNK } from './exportRepository';

/**
 * The bulk loader's tests run against the real SQLite harness (ADR-019): the point of this module
 * is the SQL, so a fake would test nothing.
 */
describe('exportRepository.load', () => {
  it('returns every record with its doctors, medications, readings, vitals and attachments', () => {
    const fixture = createRepositoryFixture();
    const { repos, personId } = fixture;

    const doctor = repos.doctors.ensure({ name: 'Dr Test', specialty: 'Synthetic' });
    if (!doctor.ok) throw new Error('doctor fixture failed');

    const created = repos.records.create(personId, {
      ...recordInput({
        date: '2026-11-02',
        symptoms: ['headache', 'mild fever'],
        comments: 'Synthetic comment',
        followUpOn: '2026-12-02',
        doctorId: doctor.value.id,
        medications: [{ name: 'Metformin', dose: '500 mg', frequency: 'twice a day' }],
        readings: [
          { name: 'Hb', value: '13.5', unit: 'g/dL', refLow: 13, refHigh: 17, flag: 'normal' },
        ],
        vitals: [{ kind: 'bp', v1: 120, v2: 80 }],
        attachments: [
          {
            id: 'attachment-1',
            role: 'lab_report',
            mime: 'application/pdf',
            relPath: 'attachments/p/r/attachment-1.pdf',
            thumbRelPath: null,
            bytes: 1000,
            sha256: 'a'.repeat(64),
          },
        ],
      }),
    });
    if (!created.ok) throw new Error('record fixture failed');

    const [row] = repos.exports.load(personId);
    expect(row).toBeDefined();
    expect(row?.id).toBe(created.value);
    expect(row?.symptoms).toEqual(['headache', 'mild fever']);
    expect(row?.doctorName).toBe('Dr Test');
    expect(row?.medications.map((entry) => entry.name)).toEqual(['Metformin']);
    expect(row?.readings.map((entry) => entry.name)).toEqual(['Hb']);
    expect(row?.measurements.map((entry) => entry.kind)).toEqual(['bp']);
    expect(row?.attachmentRoles).toEqual(['lab_report']);
    fixture.close();
  });

  it('keeps a missing doctor as null instead of failing', () => {
    const fixture = createRepositoryFixture();
    fixture.repos.records.create(fixture.personId, recordInput({ doctorId: null }));
    const [row] = fixture.repos.exports.load(fixture.personId);
    expect(row?.doctorName).toBeNull();
    fixture.close();
  });

  it('drops standalone measurements that belong to no record', () => {
    const fixture = createRepositoryFixture();
    fixture.repos.measurements.create(fixture.personId, {
      kind: 'weight',
      v1: 70,
      v2: null,
      measuredOn: '2026-11-01',
    });
    fixture.repos.records.create(fixture.personId, recordInput());
    const [row] = fixture.repos.exports.load(fixture.personId);
    expect(row?.measurements).toEqual([]);
    fixture.close();
  });

  it('filters by an inclusive date range and by record type', () => {
    const fixture = createRepositoryFixture();
    const { repos, personId } = fixture;
    repos.records.create(personId, recordInput({ date: '2025-12-31', kind: 'doctor_visit' }));
    repos.records.create(personId, recordInput({ date: '2026-01-01', kind: 'lab_test' }));
    repos.records.create(personId, recordInput({ date: '2026-06-15', kind: 'doctor_visit' }));
    repos.records.create(personId, recordInput({ date: '2026-12-31', kind: 'vaccination' }));

    const inRange = repos.exports.load(personId, { from: '2026-01-01', to: '2026-06-15' });
    expect(inRange.map((row) => row.date)).toEqual(['2026-06-15', '2026-01-01']);

    const onlyVisits = repos.exports.load(personId, { kinds: ['doctor_visit'] });
    expect(onlyVisits.map((row) => row.date)).toEqual(['2026-06-15', '2025-12-31']);

    const both = repos.exports.load(personId, {
      from: '2026-01-01',
      to: '2026-12-31',
      kinds: ['lab_test'],
    });
    expect(both.map((row) => row.date)).toEqual(['2026-01-01']);
    fixture.close();
  });

  it('never returns another person’s records', () => {
    const fixture = createRepositoryFixture();
    const other = fixture.addPerson('Synthetic Other');
    fixture.repos.records.create(other, recordInput({ title: 'Other person record' }));
    fixture.repos.records.create(fixture.personId, recordInput({ title: 'Mine' }));

    const rows = fixture.repos.exports.load(fixture.personId);
    expect(rows.map((row) => row.title)).toEqual(['Mine']);
    fixture.close();
  });

  it('returns nothing, cheaply, when no record matches', () => {
    const fixture = createRepositoryFixture();
    const before = fixture.database.statementCount();
    const rows = fixture.repos.exports.load(fixture.personId, { from: '2030-01-01' });
    expect(rows).toEqual([]);
    // One statement: the record query. No child query runs for an empty set.
    expect(fixture.database.statementCount() - before).toBe(1);
    fixture.close();
  });

  it('tolerates a damaged symptoms value', () => {
    const fixture = createRepositoryFixture();
    fixture.repos.records.create(fixture.personId, recordInput());
    fixture.database.raw.exec("UPDATE record SET symptoms = 'not json'");
    const [row] = fixture.repos.exports.load(fixture.personId);
    expect(row?.symptoms).toEqual([]);
    fixture.close();
  });
});

describe('exportRepository.load at volume', () => {
  it('is not capped: 1,000 records come back in one pass', () => {
    const fixture = createRepositoryFixture();
    const { repos, personId, database } = fixture;
    const doctor = repos.doctors.ensure({ name: 'Dr Volume' });
    if (!doctor.ok) throw new Error('doctor fixture failed');

    const now = Date.now();
    database.db.transaction((tx) => {
      for (let index = 0; index < 1000; index += 1) {
        const id = `volume-${String(index).padStart(4, '0')}`;
        const month = String((index % 12) + 1).padStart(2, '0');
        const day = String((index % 28) + 1).padStart(2, '0');
        const date = `2025-${month}-${day}`;
        tx.insert(record)
          .values({
            id,
            personId,
            date,
            kind: 'lab_test',
            title: `Synthetic panel ${index}`,
            symptoms: JSON.stringify(['synthetic symptom']),
            condition: '',
            doctorId: doctor.value.id,
            facility: 'Synthetic Lab',
            prescriptionText: '',
            comments: `Synthetic note ${index}`,
            followUpOn: null,
            createdAt: now + index,
            updatedAt: now + index,
          })
          .run();
        tx.insert(testResult)
          .values({
            id: `${id}-reading`,
            recordId: id,
            name: 'Hb',
            value: '13.5',
            numericValue: 13.5,
            unit: 'g/dL',
            refLow: 13,
            refHigh: 17,
            flag: 'normal',
            source: 'manual',
            reviewedAt: now,
          })
          .run();
        tx.insert(measurement)
          .values({
            id: `${id}-vital`,
            personId,
            recordId: id,
            kind: 'pulse',
            v1: 72,
            v2: null,
            measuredOn: date,
            createdAt: now + index,
            profileExcluded: false,
          })
          .run();
      }
    });

    const before = database.statementCount();
    const rows = repos.exports.load(personId);
    const queries = database.statementCount() - before;

    expect(rows).toHaveLength(1000);
    expect(rows[0]?.readings).toHaveLength(1);
    expect(rows[0]?.measurements).toHaveLength(1);

    // Six reads, plus one extra chunk per child table past EXPORT_QUERY_CHUNK ids:
    // records 1 + doctors 1 + medications 2 + readings 2 + measurements 2 + attachments 2 = 10.
    // An N+1 loader would run more than 3,000 statements for the same data (ADR-048).
    const childChunks = Math.ceil(1000 / EXPORT_QUERY_CHUNK);
    expect(childChunks).toBe(2);
    expect(queries).toBe(2 + 4 * childChunks);
    fixture.close();
  });
});
