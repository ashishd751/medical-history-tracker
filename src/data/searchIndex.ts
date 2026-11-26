import { sql } from 'drizzle-orm';

import type { AppDatabase } from './db';

/**
 * Rebuilds the full-text index from the `record` table (ADR-023).
 *
 * `record_fts` is an external-content table keyed by `record.rowid`, and the ordinary write path
 * keeps it in step through triggers. Two situations bypass that:
 *
 * - `VACUUM` may renumber rowids, silently desynchronising the index. The app must never run it.
 * - A bulk import that defers or disables triggers (Phase 5 backup) must rebuild afterwards.
 *
 * FTS5's built-in `rebuild` command re-reads every record, so this is safe to call even when the
 * index is only suspected of being stale.
 */
export function rebuildSearchIndex(db: AppDatabase): void {
  db.run(sql`INSERT INTO record_fts(record_fts) VALUES('rebuild')`);
}
