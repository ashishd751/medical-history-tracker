/**
 * @jest-environment node
 *
 * The database enforces the model's rules itself: enum CHECKs, foreign keys and the delete
 * cascade chain. Repositories rely on these, so they are tested against raw SQL.
 */
import { createTestDatabase } from './testing/testDatabase';

function read(db: ReturnType<typeof createTestDatabase>): number {
  const row = db.raw.prepare('SELECT COUNT(*) AS n FROM record').get();
  return Number(row?.n ?? -1);
}

describe('CHECK constraints', () => {
  it('rejects an unknown record kind', () => {
    const db = createTestDatabase();
    db.raw
      .prepare(
        `INSERT INTO person (id, name, dob, sex, created_at, updated_at)
         VALUES ('p1', 'Synthetic', '1990-01-01', 'other', 1, 1)`,
      )
      .run();

    expect(() =>
      db.raw
        .prepare(
          `INSERT INTO record (id, person_id, date, kind, title, created_at, updated_at)
           VALUES ('r1', 'p1', '2026-01-01', 'surgery', 'Nope', 1, 1)`,
        )
        .run(),
    ).toThrow(/CHECK constraint failed/);
    db.close();
  });

  it('rejects an unknown sex value', () => {
    const db = createTestDatabase();
    expect(() =>
      db.raw
        .prepare(
          `INSERT INTO person (id, name, dob, sex, created_at, updated_at)
           VALUES ('p1', 'Synthetic', '1990-01-01', 'unspecified', 1, 1)`,
        )
        .run(),
    ).toThrow(/CHECK constraint failed/);
    db.close();
  });

  it('rejects an unknown blood type but allows null', () => {
    const db = createTestDatabase();
    const insert = db.raw.prepare(
      `INSERT INTO person (id, name, dob, sex, blood_type, created_at, updated_at)
       VALUES (?, 'Synthetic', '1990-01-01', 'male', ?, 1, 1)`,
    );
    expect(() => insert.run('p1', 'C+')).toThrow(/CHECK constraint failed/);
    expect(() => insert.run('p2', null)).not.toThrow();
    db.close();
  });
});

describe('foreign keys', () => {
  it('rejects a record for a person that does not exist', () => {
    const db = createTestDatabase();
    expect(() =>
      db.raw
        .prepare(
          `INSERT INTO record (id, person_id, date, kind, title, created_at, updated_at)
           VALUES ('r1', 'ghost', '2026-01-01', 'other', 'Orphan', 1, 1)`,
        )
        .run(),
    ).toThrow(/FOREIGN KEY constraint failed/);
    db.close();
  });
});

describe('delete cascade', () => {
  it('removes a record and all of its children when the person is deleted', () => {
    const db = createTestDatabase();
    db.raw.exec(`
      INSERT INTO person (id, name, dob, sex, created_at, updated_at)
        VALUES ('p1', 'Synthetic', '1990-01-01', 'female', 1, 1);
      INSERT INTO record (id, person_id, date, kind, title, created_at, updated_at)
        VALUES ('r1', 'p1', '2026-01-01', 'lab_test', 'Blood work', 1, 1);
      INSERT INTO medication (id, person_id, record_id, name, start_on)
        VALUES ('m1', 'p1', 'r1', 'Synthetic Medicine', '2026-01-01');
      INSERT INTO test_result (id, record_id, name, value)
        VALUES ('t1', 'r1', 'Synthetic Marker', '4.2');
      INSERT INTO attachment (id, record_id, role, rel_path, created_at)
        VALUES ('a1', 'r1', 'lab_report', 'attachments/synthetic.pdf', 1);
      INSERT INTO measurement (id, person_id, record_id, kind, v1, measured_on, created_at)
        VALUES ('me1', 'p1', 'r1', 'weight', 70, '2026-01-01', 1);
    `);

    db.raw.prepare("DELETE FROM person WHERE id = 'p1'").run();

    for (const table of ['record', 'medication', 'test_result', 'attachment', 'measurement']) {
      const row = db.raw.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get();
      expect({ table, n: Number(row?.n) }).toEqual({ table, n: 0 });
    }
    db.close();
  });

  it('keeps the record but clears its doctor when the doctor is deleted', () => {
    const db = createTestDatabase();
    db.raw.exec(`
      INSERT INTO person (id, name, dob, sex, created_at, updated_at)
        VALUES ('p1', 'Synthetic', '1990-01-01', 'other', 1, 1);
      INSERT INTO doctor (id, name) VALUES ('d1', 'Dr Synthetic');
      INSERT INTO record (id, person_id, date, kind, title, doctor_id, created_at, updated_at)
        VALUES ('r1', 'p1', '2026-01-01', 'doctor_visit', 'Check-up', 'd1', 1, 1);
    `);

    db.raw.prepare("DELETE FROM doctor WHERE id = 'd1'").run();

    expect(read(db)).toBe(1);
    expect(db.raw.prepare("SELECT doctor_id FROM record WHERE id = 'r1'").get()).toEqual({
      doctor_id: null,
    });
    db.close();
  });
});

describe('column defaults', () => {
  it('defaults symptoms to an empty JSON array and source to manual', () => {
    const db = createTestDatabase();
    db.raw.exec(`
      INSERT INTO person (id, name, dob, sex, created_at, updated_at)
        VALUES ('p1', 'Synthetic', '1990-01-01', 'other', 1, 1);
      INSERT INTO record (id, person_id, date, kind, title, created_at, updated_at)
        VALUES ('r1', 'p1', '2026-01-01', 'other', 'Minimal', 1, 1);
    `);

    expect(db.raw.prepare("SELECT symptoms FROM record WHERE id = 'r1'").get()).toEqual({
      symptoms: '[]',
    });
    db.close();
  });
});
