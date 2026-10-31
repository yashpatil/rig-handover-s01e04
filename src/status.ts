import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { lastBeat, type Beat } from './heartbeat.js';
import { readNight } from './digest/read.js';

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: { night: string; ok: number; retry: number; fail: number }[];
};

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export function readStatus(config: RigConfig): Status {
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: nightsOnDisk(config.runsDir).map((night) => {
      const rows = readNight(config.runsDir, night)?.rows ?? [];
      const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((t, r) => t + f(r), 0);
      return {
        night,
        ok: sum((r) => r.runs - r.retries - r.fails),
        retry: sum((r) => r.retries),
        fail: sum((r) => r.fails),
      };
    }),
  };
}
