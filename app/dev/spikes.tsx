import { prepareVision, recognizeText } from 'expo-ai-kit';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import * as SQLite from 'expo-sqlite';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import PdfThumbnail from 'react-native-pdf-thumbnail';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { unzip, zip } from 'react-native-zip-archive';

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

const SAMPLES_DIR = 'samples';

/** Files the user drops into the app's Documents/samples folder for local testing. */
function sampleFiles(extension: 'image' | 'pdf'): File[] {
  const dir = new Directory(Paths.document, SAMPLES_DIR);
  if (!dir.exists) return [];
  const files = dir.list().filter((entry): entry is File => entry instanceof File);
  return files.filter((file) =>
    extension === 'pdf'
      ? file.name.toLowerCase().endsWith('.pdf')
      : /\.(jpe?g|png)$/i.test(file.name),
  );
}

/**
 * SPIKE (f). Runs the OCR engine over local samples and reports only aggregate
 * metrics — never the recognised text, which would be real medical data.
 */
async function runOcr(): Promise<CheckResult> {
  try {
    const images = sampleFiles('image');
    if (images.length === 0) {
      return { name: 'expo-ai-kit OCR', ok: false, detail: 'no images in Documents/samples' };
    }

    // Android ships the text-recognition model via Play services and requires this
    // before the first call; iOS resolves immediately.
    await prepareVision({ features: ['text-recognition'] });

    const lowConfidence: string[] = [];
    const perFile: string[] = [];
    let totalLines = 0;
    let confidenceSum = 0;
    let confidenceLines = 0;

    for (const image of images) {
      const result = await recognizeText({ uri: image.uri });
      const lines = result.blocks.flatMap((block) => block.lines);
      const confidences = lines
        .map((line) => line.confidence)
        .filter((value): value is number => typeof value === 'number');

      totalLines += lines.length;
      confidenceSum += confidences.reduce((a, b) => a + b, 0);
      confidenceLines += confidences.length;

      if (confidences.length > 0) {
        const mean = confidences.reduce((a, b) => a + b, 0) / confidences.length;
        perFile.push(`${image.name.replace(/\.jpe?g$/i, '').slice(0, 9)}=${mean.toFixed(2)}`);
        // HW-3 starting threshold: a mean below 0.6 suggests handwriting or a poor photo.
        if (mean < 0.6) {
          lowConfidence.push(`${image.name.slice(0, 10)}=${mean.toFixed(2)}`);
        }
      }
    }

    const overall = confidenceLines > 0 ? (confidenceSum / confidenceLines).toFixed(2) : 'n/a';
    return {
      name: 'expo-ai-kit OCR',
      ok: totalLines > 0,
      detail: `${images.length} images, ${totalLines} lines, mean ${overall}, below-0.60: ${
        lowConfidence.length === 0 ? 'none' : lowConfidence.join(' ')
      } | ${perFile.join(' ')}`,
    };
  } catch (error) {
    return { name: 'expo-ai-kit OCR', ok: false, detail: String(error) };
  }
}

/** SPIKE (e). Rasterises page 1 of a PDF to a JPEG thumbnail. */
async function runPdfRender(): Promise<CheckResult> {
  try {
    const pdfs = sampleFiles('pdf');
    if (pdfs.length === 0) {
      return {
        name: 'react-native-pdf-thumbnail',
        ok: false,
        detail: 'no PDFs in Documents/samples',
      };
    }

    const pdf = pdfs[0];
    if (!pdf) return { name: 'react-native-pdf-thumbnail', ok: false, detail: 'no PDF' };

    const thumb = await PdfThumbnail.generate(pdf.uri, 0, { quality: 70, maxWidth: 1500 });
    const rendered = new File(thumb.uri);
    return {
      name: 'react-native-pdf-thumbnail',
      ok: thumb.width > 0 && thumb.height > 0,
      detail: `page1 ${thumb.width}x${thumb.height}px jpeg=${rendered.size}B from ${pdf.name.slice(0, 14)}`,
    };
  } catch (error) {
    return { name: 'react-native-pdf-thumbnail', ok: false, detail: String(error) };
  }
}

/** SPIKE (h). Zips the sample folder and unzips it again, comparing file counts. */
async function runZip(): Promise<CheckResult> {
  try {
    const source = new Directory(Paths.document, SAMPLES_DIR);
    if (!source.exists) {
      return { name: 'react-native-zip-archive', ok: false, detail: 'no Documents/samples folder' };
    }

    const before = source.list().length;
    const archive = new File(Paths.cache, 'spike.zip');
    if (archive.exists) archive.delete();

    await zip(source.uri.replace('file://', ''), archive.uri.replace('file://', ''));

    const restored = new Directory(Paths.cache, 'spike-unzipped');
    if (restored.exists) restored.delete();
    restored.create({ intermediates: true, idempotent: true });

    await unzip(archive.uri.replace('file://', ''), restored.uri.replace('file://', ''));

    const after = restored.list().length;
    return {
      name: 'react-native-zip-archive',
      ok: archive.size > 0 && after >= before,
      detail: `zip=${archive.size}B files ${before} -> ${after}`,
    };
  } catch (error) {
    return { name: 'react-native-zip-archive', ok: false, detail: String(error) };
  }
}

export default function SpikesScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [results, setResults] = useState<CheckResult[]>([]);
  const [running, setRunning] = useState(false);

  /**
   * SPIKE (d). Opens the photo library only — never the camera. On both platforms the
   * system picker is out-of-process, so no camera or photo permission prompt appears.
   */
  async function pickImage() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] });
      const asset = result.assets?.[0];
      setResults((prev) => [
        ...prev,
        result.canceled
          ? { name: 'image picker (library only)', ok: false, detail: 'cancelled' }
          : {
              name: 'image picker (library only)',
              ok: true,
              detail: `${result.assets.length} asset(s), ${asset?.fileName ?? 'unknown'}`,
            },
      ]);
    } catch (error) {
      setResults((prev) => [
        ...prev,
        { name: 'image picker (library only)', ok: false, detail: String(error) },
      ]);
    }
  }

  /** SPIKE (d). Document picker restricted to PDFs and images. */
  async function pickDocument() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });
      setResults((prev) => [
        ...prev,
        result.canceled
          ? { name: 'document picker', ok: false, detail: 'cancelled' }
          : {
              name: 'document picker',
              ok: true,
              detail: `${result.assets.length} file(s), ${result.assets[0]?.name ?? 'unknown'}`,
            },
      ]);
    } catch (error) {
      setResults((prev) => [
        ...prev,
        { name: 'document picker', ok: false, detail: String(error) },
      ]);
    }
  }

  async function runAll() {
    setRunning(true);
    setResults([]);
    const steps: (() => Promise<CheckResult>)[] = [
      runSqlite,
      runFileSystem,
      runPrint,
      runOcr,
      runPdfRender,
      runZip,
    ];
    const collected: CheckResult[] = [];
    for (const step of steps) {
      const result = await step();
      collected.push(result);
      setResults([...collected]);
    }
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

      <AppButton
        label="Open photo library"
        variant="secondary"
        onPress={pickImage}
        disabled={running}
      />
      <AppButton
        label="Open document picker"
        variant="secondary"
        onPress={pickDocument}
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
