/**
 * @jest-environment node
 */
import { todayIso } from '../../lib/dates';
import { createRepositoryFixture } from '../testing/repositoryFixture';

describe('medicationRepository', () => {
  it('creates an ongoing medication dated today by default', () => {
    const fixture = createRepositoryFixture();
    const created = fixture.repos.medications.create(fixture.personId, {
      name: '  Synthetic Med  ',
      dose: ' 5 mg ',
    });

    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.name).toBe('Synthetic Med');
    expect(created.value.dose).toBe('5 mg');
    expect(created.value.startOn).toBe(todayIso());
    expect(created.value.status).toBe('ongoing');
    expect(created.value.source).toBe('manual');
    expect(created.value.recordId).toBeNull();
    expect(fixture.repos.medications.listCurrent(fixture.personId)).toHaveLength(1);
    fixture.close();
  });

  it('refuses a medication without a name', () => {
    const fixture = createRepositoryFixture();
    const created = fixture.repos.medications.create(fixture.personId, { name: '   ' });

    expect(created.ok).toBe(false);
    expect(fixture.repos.medications.listForPerson(fixture.personId)).toEqual([]);
    fixture.close();
  });

  it('drops a completed medication out of the current list', () => {
    const fixture = createRepositoryFixture();
    const created = fixture.repos.medications.create(fixture.personId, { name: 'Synthetic Med' });
    if (!created.ok) throw new Error('setup failed');

    const completed = fixture.repos.medications.setStatus(
      fixture.personId,
      created.value.id,
      'completed',
    );

    expect(completed.ok && completed.value.status).toBe('completed');
    expect(fixture.repos.medications.listCurrent(fixture.personId)).toEqual([]);
    expect(fixture.repos.medications.listForPerson(fixture.personId)).toHaveLength(1);
    fixture.close();
  });

  it('updates and deletes a medication', () => {
    const fixture = createRepositoryFixture();
    const created = fixture.repos.medications.create(fixture.personId, { name: 'Synthetic Med' });
    if (!created.ok) throw new Error('setup failed');

    const updated = fixture.repos.medications.update(fixture.personId, created.value.id, {
      frequency: '1-0-1',
      endOn: '2026-12-31',
    });

    expect(updated.ok).toBe(true);
    if (updated.ok) {
      expect(updated.value.frequency).toBe('1-0-1');
      expect(updated.value.endOn).toBe('2026-12-31');
      expect(updated.value.name).toBe('Synthetic Med');
    }
    expect(fixture.repos.medications.remove(fixture.personId, created.value.id).ok).toBe(true);
    expect(fixture.repos.medications.listForPerson(fixture.personId)).toEqual([]);
    fixture.close();
  });

  it('is person-scoped for reads and writes', () => {
    const fixture = createRepositoryFixture();
    const otherPerson = fixture.addPerson('Synthetic Relative');
    const created = fixture.repos.medications.create(fixture.personId, { name: 'Synthetic Med' });
    if (!created.ok) throw new Error('setup failed');

    expect(fixture.repos.medications.listCurrent(otherPerson)).toEqual([]);
    expect(
      fixture.repos.medications.update(otherPerson, created.value.id, { name: 'Hijacked' }).ok,
    ).toBe(false);
    expect(fixture.repos.medications.setStatus(otherPerson, created.value.id, 'stopped').ok).toBe(
      false,
    );
    expect(fixture.repos.medications.listCurrent(fixture.personId)[0]?.name).toBe('Synthetic Med');
    fixture.close();
  });
});
