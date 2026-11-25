/**
 * @jest-environment node
 */
import { createRepositoryFixture, recordInput } from '../testing/repositoryFixture';

describe('personRepository', () => {
  it('creates a person with empty optional fields and reads it back', () => {
    const fixture = createRepositoryFixture();
    const person = fixture.repos.people.getById(fixture.personId);

    expect(person).toMatchObject({
      name: 'Synthetic Person',
      dob: '1990-04-17',
      sex: 'female',
      bloodType: null,
      allergies: null,
      chronicConditions: null,
    });
    expect(fixture.repos.people.getFirst()?.id).toBe(fixture.personId);
    expect(fixture.repos.people.count()).toBe(1);
    fixture.close();
  });

  it('updates only the supplied fields and bumps updatedAt', () => {
    const fixture = createRepositoryFixture();
    const before = fixture.repos.people.getById(fixture.personId);

    const updated = fixture.repos.people.update(fixture.personId, {
      bloodType: 'O+',
      allergies: 'Synthetic allergy',
    });

    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.value.bloodType).toBe('O+');
    expect(updated.value.allergies).toBe('Synthetic allergy');
    expect(updated.value.name).toBe('Synthetic Person');
    expect(updated.value.chronicConditions).toBeNull();
    expect(updated.value.updatedAt).toBeGreaterThan(before?.updatedAt ?? 0);
    fixture.close();
  });

  it('reports a missing person instead of throwing', () => {
    const fixture = createRepositoryFixture();
    const result = fixture.repos.people.update('does-not-exist', { name: 'Nobody' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('DB_FAILURE');
    fixture.close();
  });

  it('deletes the person and their records by cascade', () => {
    const fixture = createRepositoryFixture();
    fixture.repos.records.create(fixture.personId, recordInput());

    expect(fixture.repos.people.remove(fixture.personId).ok).toBe(true);
    expect(fixture.repos.people.count()).toBe(0);
    expect(fixture.repos.records.count(fixture.personId)).toBe(0);
    fixture.close();
  });
});

describe('doctorRepository', () => {
  it('creates a doctor once and reuses the same row for the same name', () => {
    const fixture = createRepositoryFixture();

    const first = fixture.repos.doctors.ensure({ name: 'Dr Synthetic' });
    const second = fixture.repos.doctors.ensure({ name: '  dr synthetic  ' });

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.value.id).toBe(first.value.id);
    expect(fixture.repos.doctors.list()).toHaveLength(1);
    fixture.close();
  });

  it('fills in details that were left blank, without overwriting existing ones', () => {
    const fixture = createRepositoryFixture();
    const created = fixture.repos.doctors.ensure({ name: 'Dr Synthetic' });
    if (!created.ok) throw new Error('setup failed');

    const enriched = fixture.repos.doctors.ensure({
      name: 'Dr Synthetic',
      specialty: 'Synthetic Specialty',
      clinic: 'Synthetic Clinic',
    });
    const second = fixture.repos.doctors.ensure({
      name: 'Dr Synthetic',
      specialty: 'Different Specialty',
    });

    expect(enriched.ok && enriched.value.specialty).toBe('Synthetic Specialty');
    expect(second.ok && second.value.specialty).toBe('Synthetic Specialty');
    fixture.close();
  });

  it('searches by name substring, case-insensitively', () => {
    const fixture = createRepositoryFixture();
    fixture.repos.doctors.create({ name: 'Dr Alpha' });
    fixture.repos.doctors.create({ name: 'Dr Beta' });

    expect(fixture.repos.doctors.search('alph').map((doctor) => doctor.name)).toEqual(['Dr Alpha']);
    expect(fixture.repos.doctors.search(' DR ').map((doctor) => doctor.name)).toEqual([
      'Dr Alpha',
      'Dr Beta',
    ]);
    expect(fixture.repos.doctors.search('')).toHaveLength(2);
    fixture.close();
  });

  it('refuses an empty doctor name', () => {
    const fixture = createRepositoryFixture();
    const result = fixture.repos.doctors.ensure({ name: '   ' });

    expect(result.ok).toBe(false);
    fixture.close();
  });
});
