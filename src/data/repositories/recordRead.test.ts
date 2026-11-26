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

  describe('recordRepository FTS search', () => {
    const titles = (
      fixture: ReturnType<typeof createRepositoryFixture>,
      personId: string,
      needle: string,
    ) => fixture.repos.records.listSummaries(personId, { search: needle }).map((row) => row.title);

    it('never returns another person’s text for a shared symptom', () => {
      const fixture = createRepositoryFixture();
      const otherPerson = fixture.addPerson('Synthetic Relative');
      fixture.repos.records.create(
        fixture.personId,
        recordInput({ title: 'Synthetic mine', symptoms: ['synthetic headache'] }),
      );
      fixture.repos.records.create(
        otherPerson,
        recordInput({ title: 'Synthetic theirs', symptoms: ['synthetic headache'] }),
      );

      expect(titles(fixture, fixture.personId, 'headache')).toEqual(['Synthetic mine']);
      expect(titles(fixture, otherPerson, 'headache')).toEqual(['Synthetic theirs']);
      fixture.close();
    });

    it('matches a doctor’s name through the subquery, at any needle length', () => {
      const fixture = createRepositoryFixture();
      const doctor = fixture.repos.doctors.ensure({ name: 'Dr. Quillon' });
      if (!doctor.ok) throw new Error('setup failed');
      fixture.repos.records.create(
        fixture.personId,
        recordInput({ title: 'Synthetic visit', doctorId: doctor.value.id, symptoms: [] }),
      );
      fixture.repos.records.create(
        fixture.personId,
        recordInput({ title: 'Synthetic other', symptoms: [] }),
      );

      // Three or more characters go through FTS plus the doctor clause; two characters take the
      // `instr` branch, which also has to include the doctor.
      expect(titles(fixture, fixture.personId, 'quillon')).toEqual(['Synthetic visit']);
      expect(titles(fixture, fixture.personId, 'Dr')).toEqual(['Synthetic visit']);
      fixture.close();
    });

    it('ignores case and matches in the middle of a word', () => {
      const fixture = createRepositoryFixture();
      fixture.repos.records.create(
        fixture.personId,
        recordInput({ title: 'Synthetic check-up', symptoms: ['synthetic headache'] }),
      );

      expect(titles(fixture, fixture.personId, 'HEADACHE')).toEqual(['Synthetic check-up']);
      expect(titles(fixture, fixture.personId, 'Ache')).toEqual(['Synthetic check-up']);
      expect(titles(fixture, fixture.personId, 'synth')).toEqual(['Synthetic check-up']);
      fixture.close();
    });

    it.each([
      '%',
      'AND',
      'OR',
      '*',
      '(',
      '"',
      '***',
      'a"b',
      'NEAR(',
      'title:routine',
      'synth AND routine',
      "-'",
    ])('treats %p as literal search text', (needle) => {
      const fixture = createRepositoryFixture();
      fixture.repos.records.create(fixture.personId, recordInput({ title: 'Synthetic routine' }));

      expect(() => titles(fixture, fixture.personId, needle)).not.toThrow();
      expect(titles(fixture, fixture.personId, needle)).toEqual([]);
      fixture.close();
    });
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

  describe('recordRepository pagination', () => {
    it('walks every record once, with no gap or repeat', () => {
      const fixture = createRepositoryFixture();
      const dates = [
        '2026-01-01',
        '2026-02-01',
        '2026-03-01',
        '2026-04-01',
        '2026-05-01',
        '2026-06-01',
        '2026-07-01',
      ];
      dates.forEach((date, index) => {
        fixture.repos.records.create(
          fixture.personId,
          recordInput({ date, title: `Record ${index}` }),
        );
      });

      const first = fixture.repos.records.listPage(fixture.personId, {}, 3, 0);
      const second = fixture.repos.records.listPage(fixture.personId, {}, 3, 3);
      const third = fixture.repos.records.listPage(fixture.personId, {}, 3, 6);

      expect([first.items.length, second.items.length, third.items.length]).toEqual([3, 3, 1]);
      expect([first.hasMore, second.hasMore, third.hasMore]).toEqual([true, true, false]);

      const ids = [...first.items, ...second.items, ...third.items].map((row) => row.id);
      expect(new Set(ids).size).toBe(7);
      expect(ids[0]).toBe(first.items[0]?.id);
      fixture.close();
    });

    it('keeps a search applied across pages', () => {
      const fixture = createRepositoryFixture();
      for (const [index, date] of [
        '2026-01-01',
        '2026-02-01',
        '2026-03-01',
        '2026-04-01',
      ].entries()) {
        fixture.repos.records.create(
          fixture.personId,
          recordInput({ date, title: `Synthetic cough ${index}`, symptoms: ['cough'] }),
        );
      }
      fixture.repos.records.create(
        fixture.personId,
        recordInput({ date: '2026-05-01', title: 'Migraine' }),
      );

      const first = fixture.repos.records.listPage(fixture.personId, { search: 'cough' }, 3, 0);
      const second = fixture.repos.records.listPage(fixture.personId, { search: 'cough' }, 3, 3);

      expect(first.items).toHaveLength(3);
      expect(first.hasMore).toBe(true);
      expect(second.items).toHaveLength(1);
      expect(second.hasMore).toBe(false);
      expect(first.items.map((row) => row.title)).toEqual([
        'Synthetic cough 3',
        'Synthetic cough 2',
        'Synthetic cough 1',
      ]);
      expect(second.items[0]?.title).toBe('Synthetic cough 0');
      fixture.close();
    });
  });

  describe('recordRepository count', () => {
    it('counts every match for the filters, not just the loaded page', () => {
      const fixture = createRepositoryFixture();
      const otherPerson = fixture.addPerson('Synthetic Relative');
      for (let index = 0; index < 30; index += 1) {
        fixture.repos.records.create(
          fixture.personId,
          recordInput({
            date: '2026-01-01',
            kind: index % 2 === 0 ? 'lab_test' : 'doctor_visit',
            title: `Synthetic record ${index}`,
            symptoms: index < 10 ? ['synthetic headache'] : ['synthetic cough'],
          }),
        );
      }
      // The relative's record matches the same word: it must never inflate this person's total.
      fixture.repos.records.create(
        otherPerson,
        recordInput({ date: '2026-01-02', title: 'Synthetic headache for a relative' }),
      );

      expect(fixture.repos.records.listPage(fixture.personId, {}, 25, 0).items).toHaveLength(25);
      expect(fixture.repos.records.count(fixture.personId)).toBe(30);
      expect(fixture.repos.records.count(otherPerson)).toBe(1);
      expect(fixture.repos.records.count(fixture.personId, { kinds: ['lab_test'] })).toBe(15);
      expect(fixture.repos.records.count(fixture.personId, { search: 'headache' })).toBe(10);
      expect(fixture.repos.records.count(fixture.personId, { search: 'cough' })).toBe(20);
      expect(fixture.repos.records.count(fixture.personId, { from: '2026-01-02' })).toBe(0);
      expect(
        fixture.repos.records.count(fixture.personId, { kinds: ['lab_test'], search: 'headache' }),
      ).toBe(5);
      fixture.close();
    });
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
