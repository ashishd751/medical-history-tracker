/**
 * Settings and the record draft, both stored in `app_setting` (ADR-022).
 *
 * Stored values are JSON scalars so numbers and `null` round-trip; the record draft is stored
 * as the JSON text the form produced. A value that fails validation falls back to its default
 * instead of breaking the app, because a corrupt preference must never block the record list.
 */
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import {
  BMI_PRESETS,
  type BmiPreset,
  DEFAULT_BMI_PRESET,
  DEFAULT_UNIT_SYSTEM,
  UNIT_SYSTEMS,
  type UnitSystem,
} from '../../domain';
import { type AppError, appError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { err, ok, type Result } from '../../lib/result';
import type { AppDatabase } from '../db';
import { appSetting } from '../schema';

export const SETTING_KEYS = {
  unitSystem: 'settings.unitSystem',
  bmiPreset: 'settings.bmiPreset',
  activePersonId: 'settings.activePersonId',
  onboardedAt: 'settings.onboardedAt',
  recordDraft: 'draft.record',
} as const;

/** A draft larger than this is dropped rather than written: one form cannot bloat the database. */
export const MAX_DRAFT_LENGTH = 64 * 1024;

export interface AppSettings {
  readonly unitSystem: UnitSystem;
  readonly bmiPreset: BmiPreset;
  readonly activePersonId: string | null;
  /** Timestamp of the moment onboarding completed, or null while it is still pending. */
  readonly onboardedAt: number | null;
}

export const DEFAULT_SETTINGS: AppSettings = {
  unitSystem: DEFAULT_UNIT_SYSTEM,
  bmiPreset: DEFAULT_BMI_PRESET,
  activePersonId: null,
  onboardedAt: null,
};

export interface SettingsRepository {
  getSettings(): AppSettings;
  updateSettings(patch: Partial<AppSettings>): Result<AppSettings, AppError>;
  isOnboarded(): boolean;
  getRecordDraft(): string | null;
  saveRecordDraft(json: string): Result<true, AppError>;
  clearRecordDraft(): Result<true, AppError>;
  getRaw(key: string): string | null;
  setRaw(key: string, value: string): Result<true, AppError>;
}

const idSchema = z.string().min(1);
const timestampSchema = z.number().int().nonnegative();

function readJson<T>(
  stored: string | undefined,
  schema: z.ZodType<T>,
  fallback: T,
  key: string,
): T {
  if (stored === undefined) return fallback;
  try {
    const parsed = schema.safeParse(JSON.parse(stored));
    if (parsed.success) return parsed.data;
    logger.warn('Ignoring an invalid setting', { key });
    return fallback;
  } catch {
    logger.warn('Ignoring an unreadable setting', { key });
    return fallback;
  }
}

export function createSettingsRepository(db: AppDatabase): SettingsRepository {
  const readAll = (): Map<string, string> => {
    const rows = db.select().from(appSetting).all();
    return new Map(rows.map((row) => [row.key, row.value]));
  };

  const getSettings = (): AppSettings => {
    const stored = readAll();
    return {
      unitSystem: readJson(
        stored.get(SETTING_KEYS.unitSystem),
        z.enum(UNIT_SYSTEMS),
        DEFAULT_SETTINGS.unitSystem,
        SETTING_KEYS.unitSystem,
      ),
      bmiPreset: readJson(
        stored.get(SETTING_KEYS.bmiPreset),
        z.enum(BMI_PRESETS),
        DEFAULT_SETTINGS.bmiPreset,
        SETTING_KEYS.bmiPreset,
      ),
      activePersonId: readJson(
        stored.get(SETTING_KEYS.activePersonId),
        idSchema.nullable(),
        DEFAULT_SETTINGS.activePersonId,
        SETTING_KEYS.activePersonId,
      ),
      onboardedAt: readJson(
        stored.get(SETTING_KEYS.onboardedAt),
        timestampSchema.nullable(),
        DEFAULT_SETTINGS.onboardedAt,
        SETTING_KEYS.onboardedAt,
      ),
    };
  };

  const write = (entries: readonly { key: string; value: string }[]): Result<true, AppError> => {
    try {
      db.transaction((tx) => {
        for (const entry of entries) {
          tx.insert(appSetting)
            .values(entry)
            .onConflictDoUpdate({ target: appSetting.key, set: { value: entry.value } })
            .run();
        }
      });
      return ok(true);
    } catch (error) {
      return err(appError('DB_FAILURE', 'Could not save the setting.', error));
    }
  };

  return {
    getSettings,

    updateSettings(patch) {
      const entries: { key: string; value: string }[] = [];
      if (patch.unitSystem !== undefined) {
        entries.push({ key: SETTING_KEYS.unitSystem, value: JSON.stringify(patch.unitSystem) });
      }
      if (patch.bmiPreset !== undefined) {
        entries.push({ key: SETTING_KEYS.bmiPreset, value: JSON.stringify(patch.bmiPreset) });
      }
      if (patch.activePersonId !== undefined) {
        entries.push({
          key: SETTING_KEYS.activePersonId,
          value: JSON.stringify(patch.activePersonId),
        });
      }
      if (patch.onboardedAt !== undefined) {
        entries.push({ key: SETTING_KEYS.onboardedAt, value: JSON.stringify(patch.onboardedAt) });
      }

      const written = write(entries);
      if (!written.ok) return written;
      return ok(getSettings());
    },

    isOnboarded: () => getSettings().onboardedAt !== null,

    getRecordDraft: () => readAll().get(SETTING_KEYS.recordDraft) ?? null,

    saveRecordDraft(json) {
      if (json.length > MAX_DRAFT_LENGTH) {
        return err(appError('DB_FAILURE', 'The draft is too large to keep.'));
      }
      return write([{ key: SETTING_KEYS.recordDraft, value: json }]);
    },

    clearRecordDraft() {
      try {
        db.transaction((tx) => {
          tx.delete(appSetting).where(eq(appSetting.key, SETTING_KEYS.recordDraft)).run();
        });
        return ok(true);
      } catch (error) {
        return err(appError('DB_FAILURE', 'Could not clear the draft.', error));
      }
    },

    getRaw: (key) => readAll().get(key) ?? null,

    setRaw: (key, value) => write([{ key, value }]),
  };
}
