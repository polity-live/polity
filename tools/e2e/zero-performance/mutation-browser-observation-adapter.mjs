import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const voteObservationPolicy = {
  id: 'vote-success-observation/v1',
  path: 'tools/e2e/zero-performance/mutation-browser.ts',
  inputSHA256: '78385c78d503268148127429fc18ad60726e6f33723b8410545b861b05ab9dce',
  outputSHA256: '88d6615f283317eaeb2c458f5ac6059e2939f07f6fe30c987ba7f71afcb13cd4',
};
const original = `      visibleReaction: async () => {
        await expect(page.getByText('Vote submitted', { exact: true }).first()).toBeVisible();
      },`;
const replacement = `      visibleReaction: async () => {
        await observeVoteSuccess(page.getByText('Vote submitted', { exact: true }).first());
      },`;
const helperImport = "import { observeVoteSuccess } from './mutation-browser-observation';\n";
const digest = value => createHash('sha256').update(value).digest('hex');
const canonical = value => value.replaceAll('\r\n', '\n');

/** Change only the declared observation and import; reject every unreviewed source revision. */
export function adaptVoteSuccessObserver(input) {
  const source = input.toString('utf8');
  assert.equal(Buffer.from(source).compare(input), 0, 'Observation source is not UTF-8');
  assert.equal(
    source.includes('\r\n') && /(?<!\r)\n/.test(source),
    false,
    'Observation source has mixed line endings'
  );
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  const before = original.replaceAll('\n', eol);
  const after = replacement.replaceAll('\n', eol);
  const prefix = helperImport.replaceAll('\n', eol);
  assert.equal(source.split(before).length - 1, 1, 'Expected exactly one vote observer');
  assert.equal(
    digest(canonical(source)),
    voteObservationPolicy.inputSHA256,
    'Unreviewed observation source'
  );
  const output = prefix + source.replace(before, after);
  assert.equal(
    output.slice(prefix.length).replace(after, before),
    source,
    'Observation changes are not reversible'
  );
  assert.equal(
    digest(canonical(output)),
    voteObservationPolicy.outputSHA256,
    'Unexpected observation output'
  );
  return {
    source: Buffer.from(output),
    provenance: {
      ...voteObservationPolicy,
      inputRawSHA256: digest(input),
      outputRawSHA256: digest(output),
      replacementEOL: eol === '\r\n' ? 'CRLF' : 'LF',
      replacements: 1,
      deadlineMs: 5_000,
      pollingMs: 16,
      criterion: 'exact-first-locator-public-isVisible',
      start: 'after-perform',
    },
  };
}

/** The same declared harness binds preparation receipts and manifested executions. */
export function bindVoteObservation(provenance, modules, harnessDigest, execution, sourceRef) {
  assert.equal(
    execution ? execution.harnessDigest : harnessDigest,
    harnessDigest,
    'Observation harness differs from execution digest'
  );
  return {
    ...provenance,
    modules,
    harnessDigest,
    execution,
    sourceRef,
    sourceIdentity: 'original-revision-with-declared-observation-transformation',
  };
}
