#!/usr/bin/env node
/**
 * Search benchmark for ADR-023.
 *
 * Seeds a throwaway in-memory SQLite database with 20,000 synthetic records, then times the
 * pre-FTS `instr` scan against the FTS5 trigram index for the same mid-word symptom query
 * ("ache", which matches "headache"). Both queries use the shape the app really runs: filter by
 * person, newest first, 25 rows.
 *
 * Run with `npm run bench:search`. It is deliberately outside Jest: timing assertions in a test
 * suite would be flaky on CI, and this is evidence for a decision, not a regression guard.
 *
 * Every value here is invented. Nothing in this file is medical data.
 */
import { DatabaseSync } from 'node:sqlite';

const RECORD_COUNT = 20_000;
const RUNS = 21;
const WARMUPS = 3;
const PERSON = 'person-1';

const SYMPTOMS = [
  'synthetic headache',
  'synthetic cough',
  'synthetic fatigue',
  'synthetic nausea',
  'synthetic backache',
  'synthetic rash',
  'synthetic fever',
  'synthetic dizziness',
  'synthetic sore throat',
  'synthetic joint ache',
  'synthetic stomach ache',
  'synthetic toothache',
];
const KINDS = ['doctor_visit', 'lab_test', 'self_care', 'procedure', 'vaccination', 'other'];
const FACILITIES = [
  'Synthetic General Hospital',
  'Synthetic Family Clinic',
  'Synthetic Diagnostic Centre',
  'Synthetic Community Health Unit',
];
const COMMENTS = [
  'Synthetic follow-up advised in two weeks.',
  'Synthetic sample collected in the morning.',
  'Synthetic review of previous results.',
  '',
];

/** Deterministic pseudo-random source, so two runs on the same machine are comparable. */
let randomState = 20261126;
function random() {
  randomState = (randomState * 1664525 + 1013904223) % 4294967296;
  return randomState / 4294967296;
}
function pick(values) {
  return values[Math.floor(random() * values.length)];
}
function dateAt(index) {
  const year = 2020 + (index % 6);
  const month = String((index % 12) + 1).padStart(2, '0');
  const day = String((index % 28) + 1).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createSchema(db) {
  db.exec(`
    CREATE TABLE record (
      id TEXT PRIMARY KEY,
      person_id TEXT NOT NULL,
      date TEXT NOT NULL,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      symptoms TEXT NOT NULL DEFAULT '[]',
      condition TEXT NOT NULL DEFAULT '',
      facility TEXT NOT NULL DEFAULT '',
      prescription_text TEXT NOT NULL DEFAULT '',
      comments TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX record_person_id_date_idx ON record (person_id, date);
    CREATE VIRTUAL TABLE record_fts USING fts5(
      title, condition, symptoms, facility, prescription_text, comments,
      content='record',
      content_rowid='rowid',
      tokenize='trigram'
    );
    CREATE TRIGGER record_fts_ai AFTER INSERT ON record BEGIN
      INSERT INTO record_fts (rowid, title, condition, symptoms, facility, prescription_text, comments)
      VALUES (new.rowid, new.title, new.condition, new.symptoms, new.facility, new.prescription_text, new.comments);
    END;
  `);
}

function seed(db) {
  const insert = db.prepare(`
    INSERT INTO record (id, person_id, date, kind, title, symptoms, condition, facility,
                        prescription_text, comments, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db.exec('BEGIN');
  for (let index = 0; index < RECORD_COUNT; index += 1) {
    // Every 2,500th record is a deliberately rare term, so the benchmark can show the case where
    // the old scan cannot stop early because there are far fewer matches than a page.
    const symptom = index % 2500 === 1250 ? 'synthetic sarcoidosis' : pick(SYMPTOMS);
    const kind = pick(KINDS);
    insert.run(
      `record-${index}`,
      index % 2 === 0 ? PERSON : 'person-2',
      dateAt(index),
      kind,
      `Synthetic ${kind.replace('_', ' ')} for ${symptom}`,
      JSON.stringify([symptom]),
      `Synthetic ${symptom}`,
      pick(FACILITIES),
      random() < 0.2 ? `Synthetic prescription for ${symptom}` : '',
      pick(COMMENTS),
      index,
      index,
    );
  }
  db.exec('COMMIT');
}

const instrPredicate = `
      instr(lower(title), ?) > 0 OR
      instr(lower(condition), ?) > 0 OR
      instr(lower(symptoms), ?) > 0 OR
      instr(lower(facility), ?) > 0 OR
      instr(lower(prescription_text), ?) > 0 OR
      instr(lower(comments), ?) > 0`;

const OLD_PAGE_SQL = `
  SELECT id FROM record
  WHERE person_id = ? AND (${instrPredicate})
  ORDER BY date DESC, created_at DESC
  LIMIT 25
`;

const NEW_PAGE_SQL = `
  SELECT r.id FROM record r
  WHERE r.rowid IN (SELECT rowid FROM record_fts WHERE record_fts MATCH ?)
    AND r.person_id = ?
  ORDER BY r.date DESC, r.created_at DESC
  LIMIT 25
`;

const OLD_COUNT_SQL = `
  SELECT COUNT(*) AS n FROM record WHERE person_id = ? AND (${instrPredicate})
`;

const NEW_COUNT_SQL = `
  SELECT COUNT(*) AS n FROM record r
  WHERE r.rowid IN (SELECT rowid FROM record_fts WHERE record_fts MATCH ?)
    AND r.person_id = ?
`;

function time(run) {
  for (let index = 0; index < WARMUPS; index += 1) run();
  const samples = [];
  for (let index = 0; index < RUNS; index += 1) {
    const start = performance.now();
    run();
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)];
  const p95 = samples[Math.min(samples.length - 1, Math.ceil(samples.length * 0.95) - 1)];
  return { median, p95 };
}

const ms = (value) => `${value.toFixed(2)} ms`.padStart(10);

const db = new DatabaseSync(':memory:');
createSchema(db);
seed(db);

const oldPage = db.prepare(OLD_PAGE_SQL);
const newPage = db.prepare(NEW_PAGE_SQL);
const oldCount = db.prepare(OLD_COUNT_SQL);
const newCount = db.prepare(NEW_COUNT_SQL);

const needles = (term) => Array(6).fill(term);
const phrase = (term) => `"${term}"`;

const pageOld = (term) => oldPage.all(PERSON, ...needles(term));
const pageNew = (term) => newPage.all(phrase(term), PERSON);
const countOld = (term) => oldCount.get(PERSON, ...needles(term)).n;
const countNew = (term) => newCount.get(phrase(term), PERSON).n;

// "ache" is the query from the brief: a mid-word symptom that matches a large share of records.
// "sarcoidosis" is rare: the old scan has to read every row because it never reaches one page.
const scenarios = [
  { name: 'common "ache" · page', oldRun: () => pageOld('ache'), newRun: () => pageNew('ache') },
  {
    name: 'rare "sarcoidosis" · page',
    oldRun: () => pageOld('sarcoidosis'),
    newRun: () => pageNew('sarcoidosis'),
  },
  {
    name: 'common "ache" · count',
    oldRun: () => countOld('ache'),
    newRun: () => countNew('ache'),
  },
  {
    name: 'rare "sarcoidosis" · count',
    oldRun: () => countOld('sarcoidosis'),
    newRun: () => countNew('sarcoidosis'),
  },
].map((scenario) => ({
  ...scenario,
  old: time(scenario.oldRun),
  new: time(scenario.newRun),
}));

const plan = db
  .prepare(`EXPLAIN QUERY PLAN ${NEW_PAGE_SQL}`)
  .all(phrase('ache'), PERSON)
  .map((row) => row.detail)
  .join(' | ');
const pageCount = db.prepare('PRAGMA page_count').get().page_count;
const pageSize = db.prepare('PRAGMA page_size').get().page_size;

const sameFirstPage =
  pageOld('ache')
    .map((row) => row.id)
    .join(',') ===
  pageNew('ache')
    .map((row) => row.id)
    .join(',');

console.log('Synthetic search benchmark (ADR-023)');
console.log(
  `SQLite ${db.prepare('SELECT sqlite_version() AS v').get().v}, Node ${process.version}, ` +
    `records ${RECORD_COUNT.toLocaleString('en-US')} (${RECORD_COUNT / 2} per person), ` +
    `database ${((pageCount * pageSize) / 1024 / 1024).toFixed(1)} MiB`,
);
console.log(`${RUNS} timed runs after ${WARMUPS} warm-ups; all values synthetic.`);
console.log(
  `"ache" matches: instr ${countOld('ache')}, FTS ${countNew('ache')}; ` +
    `"sarcoidosis": instr ${countOld('sarcoidosis')}, FTS ${countNew('sarcoidosis')}; ` +
    `same first page: ${sameFirstPage}`,
);
console.log(`FTS plan: ${plan}`);
console.log('');
console.log(
  `scenario`.padEnd(28) +
    `instr med`.padStart(11) +
    `instr p95`.padStart(11) +
    `FTS med`.padStart(11) +
    `FTS p95`.padStart(11) +
    `speed-up`.padStart(10),
);
for (const scenario of scenarios) {
  console.log(
    scenario.name.padEnd(28) +
      ms(scenario.old.median) +
      ms(scenario.old.p95) +
      ms(scenario.new.median) +
      ms(scenario.new.p95) +
      `${(scenario.old.median / scenario.new.median).toFixed(1)}x`.padStart(10),
  );
}

db.close();
