#!/usr/bin/env node
/**
 * Prints synthetic SQL for the Phase 4 PDF export checks.
 *
 * Everything here is invented: names, symptoms, doctors and values. Never add real medical data to
 * this file (AGENTS.md, non-negotiable 1). The SQL is applied to the app's own database with
 * `sqlite3` while the app is stopped, because driving 1,000 records through the UI is too slow.
 *
 * Usage: node scripts/seed-export-demo.mjs [count]
 * Output: SQL on stdout. See docs/TESTING.md, section "Seeding export records".
 */
const count = Number.parseInt(process.argv[2] ?? '12', 10);
if (!Number.isFinite(count) || count < 0) {
  console.error('Usage: node scripts/seed-export-demo.mjs [count]');
  process.exit(1);
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Fixed clock so two runs produce identical SQL; the dates stay inside this window. */
const START = Date.UTC(2025, 0, 5);
const END = Date.UTC(2026, 10, 20);
const NOW = Date.UTC(2026, 10, 20);
/** Days between two consecutive records, so any count fills the same window. */
const STEP_DAYS = Math.max(1, Math.floor((END - START) / DAY_MS / Math.max(1, count - 1)));

const KINDS = ['doctor_visit', 'lab_test', 'vaccination', 'procedure', 'self_care', 'other'];
const PERSON = '(select id from person order by created_at limit 1)';

/** SQL string literal. */
function q(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function isoDate(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

const lines = [
  'PRAGMA foreign_keys = ON;',
  'BEGIN;',
  // Re-running the script replaces the synthetic set instead of adding to it. Deleting the records
  // cascades to their medications, readings and measurements.
  "DELETE FROM record WHERE id LIKE 'demo-%';",
  "DELETE FROM doctor WHERE id = 'demo-doctor-1';",
  `INSERT OR IGNORE INTO doctor (id, name, specialty, clinic, phone)
   VALUES ('demo-doctor-1', 'Dr Synthetic Rao', 'General medicine', 'Synthetic Clinic', '');`,
];

const hostile = [
  '<b>fever</b> & chills',
  'averyveryverylongwordthatcannotbreakandmustwrapinsidethecellbecauseitisfarwiderthananycolumn',
];
const hindi = ['सिरदर्द', 'बुखार 🩺'];
const arabic = 'صداع';

for (let index = 0; index < count; index += 1) {
  const id = `demo-${String(index).padStart(4, '0')}`;
  const date = isoDate(Math.min(END, START + index * STEP_DAYS * DAY_MS));
  const kind = KINDS[index % KINDS.length];
  const createdAt = NOW - (count - index) * 1000;
  const title = kind === 'lab_test' ? `Synthetic lipid panel ${index}` : `Synthetic visit ${index}`;
  const symptoms =
    index === 0
      ? JSON.stringify(hostile)
      : index % 7 === 0
        ? JSON.stringify(hindi)
        : index % 11 === 0
          ? JSON.stringify([arabic])
          : JSON.stringify(['synthetic headache']);
  const condition = index % 3 === 0 ? 'Synthetic migraine' : '';
  const facility = kind === 'doctor_visit' || kind === 'procedure' ? 'Synthetic Clinic' : '';
  const comments =
    index === 0
      ? 'Quoted "text" & <b>bold</b>\nsecond line of the comment'
      : `Synthetic note ${index}`;
  const followUp =
    index % 5 === 0
      ? isoDate(Math.min(END, START + index * STEP_DAYS * DAY_MS + 14 * DAY_MS))
      : null;

  lines.push(
    `INSERT INTO record (id, person_id, date, kind, title, symptoms, condition, doctor_id, facility,
       prescription_text, comments, follow_up_on, created_at, updated_at)
     VALUES (${q(id)}, ${PERSON}, ${q(date)}, ${q(kind)}, ${q(title)}, ${q(symptoms)},
       ${q(condition)}, 'demo-doctor-1', ${q(facility)}, '', ${q(comments)},
       ${followUp === null ? 'NULL' : q(followUp)}, ${createdAt}, ${createdAt});`,
  );

  if (kind === 'lab_test') {
    const readings = [
      ['Hb', '13.5', 13.5, 'g/dL', 13, 17, 'normal'],
      ['LDL', '142', 142, 'mg/dL', 70, 100, 'high'],
      ['HDL', '28', 28, 'mg/dL', 40, null, 'low'],
    ];
    readings.forEach(([name, value, numeric, unit, low, high, flag], position) => {
      lines.push(
        `INSERT INTO test_result (id, record_id, name, value, numeric_value, unit, ref_low, ref_high,
           flag, source, reviewed_at)
         VALUES (${q(`${id}-r${position}`)}, ${q(id)}, ${q(name)}, ${q(value)}, ${numeric},
           ${q(unit)}, ${low ?? 'NULL'}, ${high ?? 'NULL'}, ${q(flag)}, 'manual', ${createdAt});`,
      );
    });
  }

  // A weight and a blood pressure on every fourth record, so the profile has something to show.
  if (index % 4 === 0) {
    lines.push(
      `INSERT INTO measurement (id, person_id, record_id, kind, v1, v2, measured_on, created_at,
         profile_excluded)
       VALUES (${q(`${id}-weight`)}, ${PERSON}, ${q(id)}, 'weight', ${70 + (index % 5)}, NULL,
         ${q(date)}, ${createdAt}, 0);`,
      `INSERT INTO measurement (id, person_id, record_id, kind, v1, v2, measured_on, created_at,
         profile_excluded)
       VALUES (${q(`${id}-bp`)}, ${PERSON}, ${q(id)}, 'bp', ${118 + (index % 9)}, ${76 + (index % 7)},
         ${q(date)}, ${createdAt}, 0);`,
    );
  }

  // One medication every 250 records: enough to fill the profile header, few enough that Home's
  // chip row does not become a thousand pills long.
  if (index % 250 === 0) {
    lines.push(
      `INSERT INTO medication (id, person_id, record_id, name, dose, frequency, duration, start_on,
         end_on, status, notes, source, reviewed_at, profile_excluded)
       VALUES (${q(`${id}-med`)}, ${PERSON}, ${q(id)}, 'Syntheticstatin', '10 mg', 'at night', '',
         ${q(date)}, NULL, 'ongoing', '', 'manual', ${createdAt}, 0);`,
    );
  }
}

lines.push('COMMIT;');
process.stdout.write(`${lines.join('\n')}\n`);
