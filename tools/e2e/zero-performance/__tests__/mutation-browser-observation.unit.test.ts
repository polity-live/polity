import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { Locator } from '@playwright/test';
import { observeVoteSuccess } from '../mutation-browser-observation';
import {
  adaptVoteSuccessObserver,
  bindVoteObservation,
  voteObservationPolicy,
} from '../mutation-browser-observation-adapter.mjs';
import { applicationMechanics, mechanics, mechanicsDigest } from '../mechanics.mjs';

const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const reviewedSource = async () =>
  (await readFile(voteObservationPolicy.path, 'utf8')).replaceAll('\r\n', '\n');

describe('shared vote success observation adapter', () => {
  it.each(['\n', '\r\n'])(
    'preserves all scenario bytes outside the declared observer and import (%j)',
    async eol => {
      const canonical = await reviewedSource();
      const source = Buffer.from(canonical.replaceAll('\n', eol));
      const adapted = adaptVoteSuccessObserver(source);
      const result = adapted.source.toString('utf8');
      const imported = "import { observeVoteSuccess } from './mutation-browser-observation';" + eol;
      expect(result.startsWith(imported)).toBe(true);
      const restored = result
        .slice(imported.length)
        .replace(
          "await observeVoteSuccess(page.getByText('Vote submitted', { exact: true }).first());",
          "await expect(page.getByText('Vote submitted', { exact: true }).first()).toBeVisible();"
        );
      expect(Buffer.from(restored)).toEqual(source);
      expect(digest(result.replaceAll('\r\n', '\n'))).toBe(voteObservationPolicy.outputSHA256);
      expect(adapted.provenance).toMatchObject({
        inputSHA256: digest(canonical),
        inputRawSHA256: digest(source),
        outputRawSHA256: digest(adapted.source),
        replacements: 1,
        deadlineMs: 5_000,
        pollingMs: 16,
        start: 'after-perform',
      });
    }
  );

  it('rejects an unreviewed fixture change even with the exact observer present', async () => {
    const source = (await reviewedSource()).replace("label: 'Accept'", "label: 'Other'");
    expect(() => adaptVoteSuccessObserver(Buffer.from(source))).toThrow(
      'Unreviewed observation source'
    );
  });

  it('rejects missing and duplicate observer snippets rather than choosing one', async () => {
    const source = await reviewedSource();
    const snippet = source.match(
      / {6}visibleReaction: async \(\) => \{\n {8}await expect\(page.getByText\('Vote submitted'[^\n]+\n {6}\},/
    )?.[0];
    expect(snippet).toBeDefined();
    expect(() =>
      adaptVoteSuccessObserver(Buffer.from(source.replace(snippet as string, '')))
    ).toThrow('Expected exactly one vote observer');
    expect(() => adaptVoteSuccessObserver(Buffer.from(source + snippet))).toThrow(
      'Expected exactly one vote observer'
    );
  });

  it('rejects already adapted source and invalid encoding', async () => {
    const adapted = adaptVoteSuccessObserver(Buffer.from(await reviewedSource()));
    expect(() => adaptVoteSuccessObserver(adapted.source)).toThrow(
      'Expected exactly one vote observer'
    );
    expect(() => adaptVoteSuccessObserver(Buffer.from([0xff]))).toThrow(
      'Observation source is not UTF-8'
    );
  });

  it('rejects mixed line endings instead of normalizing unrelated source bytes', async () => {
    const source = await reviewedSource();
    expect(() => adaptVoteSuccessObserver(Buffer.from(source.replace('\n', '\r\n')))).toThrow(
      'Observation source has mixed line endings'
    );
    expect(() =>
      adaptVoteSuccessObserver(Buffer.from(source.replaceAll('\n', '\r\n').replace('\r\n', '\n')))
    ).toThrow('Observation source has mixed line endings');
  });

  it('uses the public visibility result and does not accept a pending false observation', async () => {
    const isVisible = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    await observeVoteSuccess({ isVisible } as unknown as Locator);
    expect(isVisible).toHaveBeenCalledTimes(2);
    expect(isVisible.mock.calls).toEqual([[], []]);
  });

  it('retains the original manifest digest algorithm over current raw source files', async () => {
    const hash = createHash('sha256');
    const directory = path.resolve('tools/e2e/zero-performance');
    const originalFiles = [
      ...mechanics,
      'distributed.ts',
      'distributed-runner.ts',
      'distributed-merge.ts',
      'distributed-report.ts',
      'distributed-io.ts',
      'distributed-timing.ts',
      'absolute-confirmation.ts',
      'shard-weights.json',
      'stage-artifacts.mjs',
    ];
    for (const file of originalFiles.sort())
      hash.update(file).update(await readFile(path.join(directory, file)));
    for (const file of applicationMechanics) hash.update(file).update(await readFile(file));
    expect(await mechanicsDigest(directory)).toBe(hash.digest('hex'));
  });

  it('binds preparation and execution receipts and rejects a different execution harness', async () => {
    const adapted = adaptVoteSuccessObserver(Buffer.from(await reviewedSource()));
    const directory = path.resolve('tools/e2e/zero-performance');
    const harness = await mechanicsDigest(directory);
    const modules = {
      helper: digest(await readFile(path.join(directory, 'mutation-browser-observation.ts'))),
      adapter: digest(
        await readFile(path.join(directory, 'mutation-browser-observation-adapter.mjs'))
      ),
    };
    const preparation = bindVoteObservation(
      adapted.provenance,
      modules,
      harness,
      undefined,
      'frozen-base'
    );
    expect(preparation).toMatchObject({
      harnessDigest: harness,
      sourceRef: 'frozen-base',
      modules,
    });
    const execution = { harnessDigest: harness, sourceSHA: 'frozen-base' };
    expect(
      bindVoteObservation(adapted.provenance, modules, harness, execution, 'frozen-base').execution
    ).toEqual(execution);
    expect(() =>
      bindVoteObservation(
        adapted.provenance,
        modules,
        harness,
        { harnessDigest: '0'.repeat(64) },
        'frozen-base'
      )
    ).toThrow('Observation harness differs from execution digest');
    expect(preparation.sourceIdentity).toBe(
      'original-revision-with-declared-observation-transformation'
    );
  });
});
