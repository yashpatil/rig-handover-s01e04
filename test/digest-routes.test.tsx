import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
const line = (job: string, status: string, owner: string | null) =>
  JSON.stringify({ at: '2026-01-01T02:00:00+13:00', job, status, owner });
const write = (night: string, lines: string[]) =>
  writeFileSync(join(runsDir, `${night}.jsonl`), lines.join('\n') + (lines.length ? '\n' : ''));

// zeta is logged first, so job order (alpha, mid, zeta) differs from file order
write('2026-01-01', [
  line('zeta', 'ok', 'sam'),
  line('alpha', 'ok', null),
  line('mid', 'retry', 'kim'),
  line('mid', 'retry', 'kim'),
  line('mid', 'retry', 'kim'),
]);
write('2026-01-02', []);
write('2026-01-03', [line('alpha', 'ok', 'sam'), 'not json']);
write('2026-01-04', [line('flaky', 'fail', 'sam'), line('fine', 'ok', 'sam')]);

const app = createApp({ adapter: 'shim', installed: 'x', beatEverySeconds: 60, runsDir });

const inOrder = (html: string, jobs: string[]) => {
  const at = jobs.map((j) => html.indexOf(j));
  return at.every((i) => i >= 0) && at.every((v, i) => i === 0 || at[i - 1]! < v);
};

describe('GET /digest/:night', () => {
  it('renders a table with rows in job order', async () => {
    const res = await app.request('/digest/2026-01-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('<table');
    expect(inOrder(html, ['alpha', 'mid', 'zeta'])).toBe(true);
  });

  it('marks a row with 3+ retries as warn', async () => {
    const html = await (await app.request('/digest/2026-01-01')).text();
    expect(html.match(/class="warn"/g)).toHaveLength(1);
  });

  it('marks a row with fails as warn', async () => {
    const html = await (await app.request('/digest/2026-01-04')).text();
    expect(html.match(/class="warn"/g)).toHaveLength(1);
  });

  it('shows a null owner as an em dash', async () => {
    expect(await (await app.request('/digest/2026-01-01')).text()).toContain('—');
  });

  it('404s for a night with no file', async () => {
    const res = await app.request('/digest/2026-01-09');
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('no run log for 2026-01-09');
  });

  it('says nothing ran for an empty file', async () => {
    const res = await app.request('/digest/2026-01-02');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('counts a bad line', async () => {
    const res = await app.request('/digest/2026-01-03');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('1 line did not parse');
  });
});

describe('GET /api/digest/:night', () => {
  it('returns night, rows sorted by job, and badLines', async () => {
    const res = await app.request('/api/digest/2026-01-01');
    const body = (await res.json()) as { night: string; rows: { job: string }[]; badLines: number };
    expect(res.status).toBe(200);
    expect(body.night).toBe('2026-01-01');
    expect(body.rows.map((r) => r.job)).toEqual(['alpha', 'mid', 'zeta']);
    expect(body.badLines).toBe(0);
  });

  it('404s for a night with no file', async () => {
    const res = await app.request('/api/digest/2026-01-09');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no run log', night: '2026-01-09' });
  });

  it('returns no rows for an empty file', async () => {
    const res = await app.request('/api/digest/2026-01-02');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ rows: [], badLines: 0 });
  });

  it('keeps good rows beside a bad line', async () => {
    const body = (await (await app.request('/api/digest/2026-01-03')).json()) as { rows: unknown[]; badLines: number };
    expect(body.badLines).toBe(1);
    expect(body.rows).toHaveLength(1);
  });
});

describe('page and JSON agree', () => {
  it('lists the same jobs in the same order', async () => {
    const html = await (await app.request('/digest/2026-01-01')).text();
    const { rows } = (await (await app.request('/api/digest/2026-01-01')).json()) as { rows: { job: string }[] };
    expect(inOrder(html, rows.map((r) => r.job))).toBe(true);
  });
});
