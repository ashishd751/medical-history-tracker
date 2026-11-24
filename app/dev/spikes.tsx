import { Directory, File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as SQLite from 'expo-sqlite';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton, AppCard, AppText, spacing, useAppTheme } from '@/ui';

interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

/**
 * SPIKE (b), (c), (g): proves expo-sqlite, the new expo-file-system object API and
 * expo-print actually work on a real device. Throwaway — deleted before Phase 1.
 */
async function runSqlite(): Promise<CheckResult> {
  try {
    const db = await SQLite.openDatabaseAsync('spike.db');
    await db.execAsync('DROP TABLE IF EXISTS spike');
    await db.execAsync(
      'CREATE TABLE spike (id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT NOT NULL)',
    );
    await db.runAsync('INSERT INTO spike (label) VALUES (?)', ['hello']);
    await db.runAsync('INSERT INTO spike (label) VALUES (?)', ['world']);
    const row = await db.getFirstAsync<{ id: number; label: string }>(
      'SELECT id, label FROM spike ORDER BY id DESC LIMIT 1',
    );
    const count = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM spike');
    await db.closeAsync();
    return {
      name: 'expo-sqlite',
      ok: row?.label === 'world' && count?.n === 2,
      detail: `rows=${count?.n ?? '?'} last="${row?.label ?? '?'}" id=${row?.id ?? '?'}`,
    };
  } catch (error) {
    return { name: 'expo-sqlite', ok: false, detail: String(error) };
  }
}

async function runFileSystem(): Promise<CheckResult> {
  try {
    const dir = new Directory(Paths.document, 'spike');
    dir.create({ intermediates: true, idempotent: true });
    const file = new File(dir, 'spike.txt');
    file.create({ overwrite: true });
    await file.write('medical-history-spike');
    const content = await file.text();
    const size = file.size;
    const existed = file.exists;
    file.delete();
    return {
      name: 'expo-file-system (new API)',
      ok: content === 'medical-history-spike' && !file.exists,
      detail: `read="${content}" size=${size}B existed=${String(existed)} deleted=${String(!file.exists)}`,
    };
  } catch (error) {
    return { name: 'expo-file-system (new API)', ok: false, detail: String(error) };
  }
}

async function runPrint(): Promise<CheckResult> {
  try {
    const { uri, numberOfPages } = await Print.printToFileAsync({
      html: '<h1>Spike</h1><p>Medical History export spike.</p>',
    });
    const file = new File(uri);
    const size = file.size;
    return {
      name: 'expo-print',
      ok: size > 0,
      detail: `pages=${numberOfPages} bytes=${size} path=${uri.split('/').pop() ?? '?'}`,
    };
  } catch (error) {
    return { name: 'expo-print', ok: false, detail: String(error) };
  }
}

export default function SpikesScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [results, setResults] = useState<CheckResult[]>([]);
  const [running, setRunning] = useState(false);

  async function runAll() {
    setRunning(true);
    setResults([]);
    const sqlite = await runSqlite();
    setResults([sqlite]);
    const fs = await runFileSystem();
    setResults([sqlite, fs]);
    const print = await runPrint();
    setResults([sqlite, fs, print]);
    setRunning(false);
  }

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg },
      ]}
    >
      <AppText variant="title" accessibilityRole="header">
        Library spikes
      </AppText>
      <AppText variant="caption" color="muted">
        Runs on-device checks for SQLite, FileSystem and print-to-PDF.
      </AppText>

      <AppButton
        label={running ? 'Running…' : 'Run all checks'}
        onPress={runAll}
        loading={running}
        disabled={running}
      />

      {results.map((result) => (
        <AppCard key={result.name}>
          <View style={styles.row}>
            <AppText variant="subtitle">{result.name}</AppText>
            <AppText variant="label" color={result.ok ? 'success' : 'danger'}>
              {result.ok ? 'PASS' : 'FAIL'}
            </AppText>
          </View>
          <AppText variant="caption" color="muted">
            {result.detail}
          </AppText>
        </AppCard>
      ))}

      {results.length === 0 ? (
        <AppText variant="caption" color="muted" style={{ color: colors.textMuted }}>
          No checks run yet.
        </AppText>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
