/**
 * @jest-environment node
 */
import { createRepositoryFixture, recordInput } from '../testing/repositoryFixture';

describe('recordRepository reads', () => {
  it('lists newest first and pages with limit/offset', () => {
    const fixture = createRepositoryFixture();
    fixture.repos.records.create(fixture.personId, recordInput({ date: '2026-09-01', title: 'A' }));
    fixture.repos.records.create(fixture.personId, recordInput({ date: '2026-11-02', title: 'B' }));
    fixture.repos.records.create(fixture.personId, recordInput({ date: '2026-10-15', title: 'C' }));

    expect(fixture.repos.records.listSummaries(fixture.personId).map((row) => row.title)).toEqual([
      'B',
      'C',
      'A',
    ]);
    expect(
      fixture.repos.records.listSummaries(fixture.personId, { limit: 2 }).map((row) => row.title),
    ).toEqual(['B', 'C']);
    expect(
      fixture.repos.records
        .listSummaries(fixture.personId, { limit: 2, offset: 2 })
        .map((row) => row.title),
    ).toEqual(['A']);
    fixture.close();
  });

  it('filters by kind and by an inclusive date range', () => {
    const fixture = createRepositoryFixture();
    fixture.repos.records.create(
      fixture.personId,
      recordInput({ date: '2026-09-01', kind: 'lab_test', title: 'Lab' }),
    );
    fixture.repos.records.create(
      fixture.personId,
      recordInput({ date: '2026-10-01', kind: 'doctor_visit', title: 'Visit' }),
    );
    fixture.repos.records.create(
      fixture.personId,
      recordInput({ date: '2026-11-01', kind: 'vaccination', title: 'Jab' }),
    );

    expect(
      fixture.repos.records
        .listSummaries(fixture.personId, { kinds: ['lab_test', 'vaccination'] })
        .map((row) => row.title),
    ).toEqual(['Jab', 'Lab']);
    expect(
      fixture.repos.records
        .listSummaries(fixture.personId, { from: '2026-10-01', to: '2026-11-01' })
        .map((row) => row.title),
    ).toEqual(['Jab', 'Visit']);
    fixture.close();
  });

  it('searches title, prescription text, symptoms and doctor name', () => {
    const fixture = createRepositoryFixture();
    const doctor = fixture.repos.doctors.ensure({ name: 'Dr Searchable' });
    if (!doctor.ok) throw new Error('setup failed');

    fixture.repos.records.create(
      fixture.personId,
      recordInput({
        date: '2026-11-05',
        title: 'Routine visit',
        condition: '',
        symptoms: [],
        comments: '',
        facility: '',
        doctorId: doctor.value.id,
      }),
    );
    fixture.repos.records.create(
      fixture.personId,
      recordInput({
        date: '2026-11-04',
        title: 'Blood work',
        condition: '',
        symptoms: [],
        comments: '',
        facility: '',
        prescriptionText: 'synthetic needlemark',
      }),
    );
    fixture.repos.records.create(
      fixture.personId,
      recordInput({
        date: '2026-11-03',
        title: 'Physio',
        condition: '',
        symptoms: ['synthetic tingling'],
        comments: '',
        facility: '',
      }),
    );

    const titles = (search: string) =>
      fixture.repos.records.listSummaries(fixture.personId, { search }).map((row) => row.title);

    expect(titles('searchable')).toEqual(['Routine visit']);
    expect(titles('needlemark')).toEqual(['Blood work']);
    expect(titles('TINGLING')).toEqual(['Physio']);
    expect(titles('nothing matches this')).toEqual([]);
    fixture.close();
  });

  it('treats SQL wildcards in the search box literally', () => {
    const fixture = createRepositoryFixture();
    fixture.repos.records.create(fixture.personId, recordInput({ title: 'Routine visit' }));
    fixture.repos.records.create(fixture.personId, recordInput({ title: '100% recovered' }));

    expect(
      fixture.repos.records
        .listSummaries(fixture.personId, { search: '%' })
        .map((row) => row.title),
    ).toEqual(['100% recovered']);
    expect(fixture.repos.records.listSummaries(fixture.personId, { search: '_' })).toEqual([]);
    fixture.close();
  });

  it("never returns another person's records", () => {
    const fixture = createRepositoryFixture();
    const otherPerson = fixture.addPerson('Synthetic Relative');
    fixture.repos.records.create(fixture.personId, recordInput({ title: 'Mine' }));
    fixture.repos.records.create(otherPerson, recordInput({ title: 'Theirs' }));

    expect(fixture.repos.records.listSummaries(fixture.personId).map((row) => row.title)).toEqual([
      'Mine',
    ]);
    expect(fixture.repos.records.count(fixture.personId)).toBe(1);
    expect(fixture.repos.records.count(otherPerson)).toBe(1);
    fixture.close();
  });

  it('returns the most recent records for the Home card', () => {
    const fixture = createRepositoryFixture();
    const dates = ['2026-08-01', '2026-09-01', '2026-10-01', '2026-11-01'];
    dates.forEach((date, index) => {
      fixture.repos.records.create(
        fixture.personId,
        recordInput({ date, title: `Record ${index}` }),
      );
    });

    expect(fixture.repos.records.recent(fixture.personId, 3).map((row) => row.date)).toEqual([
      '2026-11-01',
      '2026-10-01',
      '2026-09-01',
    ]);
    expect(fixture.repos.records.recent(fixture.personId)).toHaveLength(4);
    fixture.close();
  });

  it('counts lab readings through the person boundary', () => {
    const fixture = createRepositoryFixture();
    const otherPerson = fixture.addPerson('Synthetic Relative');
    fixture.repos.records.create(
      fixture.personId,
      recordInput({
        kind: 'lab_test',
        readings: [
          { name: 'A', value: '1' },
          { name: 'B', value: '2' },
        ],
      }),
    );
    const otherRecord = fixture.repos.records.create(
      otherPerson,
      recordInput({ kind: 'lab_test', readings: [{ name: 'C', value: '3' }] }),
    );
    if (!otherRecord.ok) throw new Error('setup failed');

    expect(fixture.repos.readings.countForPerson(fixture.personId)).toBe(2);
    expect(fixture.repos.readings.countForPerson(otherPerson)).toBe(1);
    expect(fixture.repos.readings.listForRecord(fixture.personId, otherRecord.value)).toEqual([]);
    fixture.close();
  });
});
