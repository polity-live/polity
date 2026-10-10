import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const target = 'tools/e2e/zero-performance/journeys.ts';
let source = (await readFile(target, 'utf8')).replaceAll('\r\n', '\n');
const start = source.indexOf('      try {\n        const retainedAt = performance.now();');
const end = source.indexOf('      // Replay only after the timed navigation samples.', start);
assert.ok(start >= 0 && end > start);
const block = source.slice(start, end);
source = source.slice(0, start) + source.slice(end);
const finish = '    return records;\n  } finally {';
assert.equal(source.split(finish).length, 2);
source = source.replace(
  finish,
  '    // Retained-query export runs after navigation and synchronization acceptance.\n' +
    "    if (process.env.ZERO_PERFORMANCE_CPU_PROFILE === '1') {\n" +
    block +
    '    }\n' +
    finish
);
await writeFile(target, source);
