import { createRequire } from 'node:module';
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const sdk = require.resolve('@rocicorp/zero');
const Database = createRequire(sdk)('@rocicorp/zero-sqlite3');
const pollerModule = pathToFileURL(
  sdk
    .replace(/zero\/src\/zero\.js$/, 'zero-cache/src/services/change-streamer/replica-poller.js')
    .replace(/zero\\src\\zero\.js$/, 'zero-cache/src/services/change-streamer/replica-poller.js')
).href;
type Watermarks = AsyncIterable<{ watermark: string }> & { cancel(): void };
const { ReplicaPoller } = (await import(pollerModule)) as {
  ReplicaPoller: new (logger: unknown, file: string) => { start(): Watermarks };
};

function logger() {
  const errors: unknown[] = [];
  const messages: unknown[] = [];
  return {
    errors,
    withContext() {
      return this;
    },
    info(...args: unknown[]) {
      messages.push(args);
    },
    warn(...args: unknown[]) {
      errors.push(args);
    },
    error(...args: unknown[]) {
      errors.push(args);
    },
  };
}

async function watermark(file: string) {
  const log = logger();
  const stream = new ReplicaPoller(log, file).start();
  try {
    const result = await stream[Symbol.asyncIterator]().next();
    expect(result.done).not.toBe(true);
    expect(log.errors).toEqual([]);
    return result.value.watermark;
  } finally {
    stream.cancel();
  }
}

function fixture() {
  const directory = mkdtempSync(path.join(tmpdir(), 'polity-readonly-poller-'));
  const file = path.join(directory, 'replica.db');
  const writer = new Database(file);
  writer.pragma('journal_mode=WAL2');
  writer.exec(`
    CREATE TABLE "_zero.replicationState" (
      stateVersion TEXT NOT NULL, writeTimeMs INTEGER NOT NULL,
      lock INTEGER PRIMARY KEY DEFAULT 1 CHECK(lock=1)
    );
    INSERT INTO "_zero.replicationState" VALUES('before',0,1);
    CREATE TABLE content(id TEXT PRIMARY KEY,value TEXT);
    CREATE INDEX content_value ON content(value);
    INSERT INTO content VALUES('one','original');
  `);
  return {
    file,
    writer,
    cleanup() {
      writer.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

describe('native SDK replica watermark polling', () => {
  it('VERIFY:ZERO:REPLICA-POLLER-READONLY: reads committed state while the writer owns its transaction and observes the next commit', async () => {
    const { file, writer, cleanup } = fixture();
    try {
      writer.exec(`BEGIN IMMEDIATE; UPDATE "_zero.replicationState" SET stateVersion='after';
        UPDATE content SET value='committed' WHERE id='one';`);
      expect(await watermark(file)).toBe('before');
      writer.exec('COMMIT');
      expect(await watermark(file)).toBe('after');
      expect(writer.prepare('SELECT value FROM content WHERE id=?').get('one')).toEqual({
        value: 'committed',
      });
      expect(
        writer.prepare("SELECT name FROM sqlite_master WHERE name='sqlite_stat1'").get()
      ).toBeUndefined();
    } finally {
      cleanup();
    }
  });

  it('preserves the existing replica statistics and schema through repeated polls', async () => {
    const { file, writer, cleanup } = fixture();
    try {
      writer.exec('ANALYZE content');
      const statistics = writer.prepare('SELECT * FROM sqlite_stat1 ORDER BY tbl,idx').all();
      const schema = writer.prepare('SELECT name,sql FROM sqlite_master ORDER BY name').all();
      expect(statistics.length).toBeGreaterThan(0);
      expect(await watermark(file)).toBe('before');
      expect(await watermark(file)).toBe('before');
      expect(writer.prepare('SELECT * FROM sqlite_stat1 ORDER BY tbl,idx').all()).toEqual(
        statistics
      );
      expect(writer.prepare('SELECT name,sql FROM sqlite_master ORDER BY name').all()).toEqual(
        schema
      );
    } finally {
      cleanup();
    }
  });

  it('fails an absent replica without creating a writable empty database', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'polity-readonly-missing-'));
    const file = path.join(directory, 'absent.db');
    let stream: Watermarks | undefined;
    try {
      expect(() => {
        stream = new ReplicaPoller(logger(), file).start();
      }).toThrow();
      expect(existsSync(file)).toBe(false);
    } finally {
      stream?.cancel();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
