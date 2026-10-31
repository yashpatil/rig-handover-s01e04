// Plan morning-digest § 1. The contract every part of § 2 builds against.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One line of runs/<night>.jsonl, once it has parsed.
export type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

// One row per job. Times keep the offset from the log; views render a null owner as `—`.
export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  fails: number; // lines with status fail; ok runs = runs - retries - fails
  lastStatus: RunStatus;
  lastError: string | null; // the most recent error the job logged, even if a later run was ok
  firstAt: string;
  lastAt: string;
};

export type Night = {
  night: string;
  rows: DigestRow[]; // sorted by job
  badLines: number; // lines that did not parse: counted, never thrown
};

// null when runs/<night>.jsonl does not exist; an empty file is a Night with no rows.
export type ReadNight = (runsDir: string, night: string) => Night | null;
