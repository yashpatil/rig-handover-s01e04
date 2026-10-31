import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

describe('readNight', () => {
  it('reads runs/2026-10-28.jsonl into one row per job', () => {
    const night = readNight('runs', '2026-10-28');
    expect(night).not.toBeNull();
    if (!night) return;
    expect(night.badLines).toBe(1);
    expect(night.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    const byJob = Object.fromEntries(night.rows.map((r) => [r.job, r]));
    expect(byJob['fixtures/refresh']).toMatchObject({
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
    expect(byJob['notes/backup']).toMatchObject({ lastStatus: 'fail', fails: 1, lastError: 'quota exceeded' });
    expect(byJob['digest/render']).toMatchObject({ owner: null, lastError: null });
  });

  it('returns null when the night has no file', () => {
    expect(readNight(mkdtempSync(join(tmpdir(), 'rig-runs-')), '2026-01-01')).toBeNull();
  });

  it('reads an empty file as a night with no rows', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
    writeFileSync(join(dir, '2026-01-01.jsonl'), '');
    expect(readNight(dir, '2026-01-01')).toEqual({ night: '2026-01-01', rows: [], badLines: 0 });
  });

  it('counts shape mismatches as bad lines and skips blank lines', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
    const lines = [
      '{"at":"t1","job":"a","status":"ok","owner":"x"}',
      '{"at":"t2","job":"a","status":"maybe","owner":"x"}',
      '{"at":"t3","job":"a","status":"ok"}',
      '[]',
      '',
    ];
    writeFileSync(join(dir, 'n.jsonl'), lines.join('\n') + '\n');
    const night = readNight(dir, 'n');
    expect(night?.badLines).toBe(3);
    expect(night?.rows).toHaveLength(1);
  });
});
