import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '../../..');

function workflow(name: string) {
  return fs.readFileSync(path.join(root, '.github', 'workflows', name), 'utf8');
}

describe('GitHub workflow contracts', () => {
  it('retries transient npm registry failures with bounded backoff', () => {
    const ci = workflow('ci.yml');

    expect(ci).toContain('NPM_CONFIG_FETCH_RETRIES: "5"');
    expect(ci).toContain('NPM_CONFIG_FETCH_RETRY_FACTOR: "2"');
    expect(ci).toContain('NPM_CONFIG_FETCH_RETRY_MINTIMEOUT: "20000"');
    expect(ci).toContain('NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT: "120000"');
    expect(ci).toContain('NPM_CONFIG_FETCH_TIMEOUT: "300000"');
  });

  it('uses valid Supabase startup syntax and the published dependency-review ref', () => {
    const ci = workflow('ci.yml');
    const staticAnalysis = ci.slice(ci.indexOf('  static-analysis:'), ci.indexOf('  unit-tests:'));

    expect(ci).not.toContain('supabase db start');
    expect(ci).toContain('run: supabase start');
    expect(ci).toContain('actions/dependency-review-action@v5.0.0');
    expect(ci).not.toContain('actions/dependency-review-action@v5\n');
    expect(staticAnalysis).toContain('fetch-depth: 0');
  });

  it('keeps seven isolated desktop shards and two isolated mobile PR jobs', () => {
    const ci = workflow('ci.yml');
    const e2e = ci.slice(ci.indexOf('  e2e-tests:'), ci.indexOf('  e2e-gate:'));
    const gate = ci.slice(ci.indexOf('  e2e-gate:'), ci.indexOf('  dependency-review:'));

    expect(e2e.match(/shard: [1-7]\/7/gu)).toHaveLength(7);
    expect(e2e.match(/shard: [12]\/2/gu)).toHaveLength(2);
    expect(e2e.match(/project: chromium-desktop/gu)).toHaveLength(7);
    expect(e2e.match(/project: chromium-mobile/gu)).toHaveLength(2);
    expect(ci).toContain('E2E_APP_COMMAND: npm run start:e2e');
    expect(ci).toContain('run: npm run build:e2e');
    expect(e2e).toContain('timeout-minutes: 25');
    expect(e2e).toContain('for attempt in 1 2 3; do');
    expect(e2e).toContain('if supabase db reset --local --no-seed; then');
    expect(e2e).toContain('Supabase reset failed after $attempt attempts');
    expect(e2e).toContain('name: Upload shard blob report');
    expect(e2e).toContain('if-no-files-found: error');
    expect(gate).toContain('name: E2E Gate');
    expect(gate).toContain('name: Validate E2E blob reports');
    expect(gate).toContain("find all-blob-reports -type f -name 'report-*.zip'");
    expect(gate).toContain('Expected nine E2E blob reports, received $blob_count');
    expect(gate).toContain('npx playwright merge-reports --reporter html all-blob-reports');
    expect(gate).toContain('name: Require successful E2E shards');
    expect(gate).toContain('E2E_SHARDS_RESULT: ${{ needs.e2e-tests.result }}');
    expect(gate).toContain('if [[ "$E2E_SHARDS_RESULT" != "success" ]]');
  });

  it('gates component flows and service integrations through fail-closed matrices', () => {
    const ci = workflow('ci.yml');
    const componentFlow = ci.slice(
      ci.indexOf('  component-flow-shards:'),
      ci.indexOf('  browser-component-tests:')
    );
    const serviceIntegration = ci.slice(
      ci.indexOf('  service-integration-shards:'),
      ci.indexOf('  database-tests:')
    );

    expect(componentFlow).toContain('shard: [1, 2, 3, 4]');
    expect(componentFlow).toContain('fail-fast: false');
    expect(componentFlow).toContain('name: Component Flow Tests');
    expect(componentFlow).toContain('if: always()');
    expect(componentFlow).toContain('needs: component-flow-shards');
    expect(componentFlow).toContain('markers=$marker_count/4');
    expect(serviceIntegration).toContain('shard: [1, 2]');
    expect(serviceIntegration).toContain('fail-fast: false');
    expect(serviceIntegration).toContain('name: Service Integration Tests');
    expect(serviceIntegration).toContain('needs: service-integration-shards');
    expect(serviceIntegration).toContain('markers=$marker_count/2');
  });

  it('runs four isolated coverage shards and gates the merged report', () => {
    const ci = workflow('ci.yml');
    const ratchet = ci.slice(ci.indexOf('  coverage-ratchet:'), ci.indexOf('  security-tests:'));

    expect(ci).toContain('coverage-shards:');
    expect(ci).toContain('shard: [1, 2, 3, 4]');
    expect(ci).toContain('COVERAGE_SHARD_ARTIFACT_DIR="$RUNNER_TEMP/polity-coverage-shards"');
    expect(ci).not.toContain('COVERAGE_SHARD_ARTIFACT_DIR: ${{ runner.temp }}');
    expect(ci).toContain('npm run test:coverage:shard -- "${{ matrix.shard }}/4"');
    expect(ci).toContain('path: .vitest-reports/blob-${{ matrix.shard }}-4.json');
    expect(ci).not.toContain('\n  coverage-tests:');
    expect(ratchet).toContain('name: Coverage Ratchet');
    expect(ratchet).toContain('if: always()');
    expect(ratchet).toContain('needs: coverage-shards');
    expect(ratchet).toContain('COVERAGE_SHARDS_RESULT: ${{ needs.coverage-shards.result }}');
    expect(ratchet).toContain('if [[ "$COVERAGE_SHARDS_RESULT" != "success" ]]');
    expect(ratchet).toContain('fetch-depth: 0');
    expect(ratchet).toContain('--merge-reports "$RUNNER_TEMP/coverage-blobs"');
    expect(ratchet).toContain('"--coverage.reportsDirectory=coverage"');
    expect(ratchet).toContain('node tools/testing/check-coverage-ratchet.mjs');
    expect(ratchet).toContain('npm run test:coverage:branches:check');
    expect(ratchet).toContain('npm run test:coverage:changed');
    expect(ratchet).toContain('npm run test:accountability:coverage');
    expect(ratchet).not.toContain('coverage-baseline');
    expect(ratchet).not.toContain('compare-coverage-reports.mjs');
  });

  it('fails closed when the recent successful PR pipeline P95 exceeds 15 minutes', () => {
    const ci = workflow('ci.yml');

    expect(ci).toContain('actions: read');
    expect(ci).toContain('pipeline-performance:');
    expect(ci).toContain('timeout-minutes: 5');
    expect(ci).toContain('GH_TOKEN: ${{ github.token }}');
    expect(ci).toContain(
      '/actions/workflows/ci.yml/runs?event=pull_request&status=success&per_page=100'
    );
    expect(ci).toContain('check-pr-pipeline-p95.mjs');
    expect(ci).toContain('--threshold-seconds 900');
    expect(ci).toContain('--min-samples 20');
    expect(ci).toContain('--max-samples 50');
    expect(ci).not.toMatch(/echo[^\n]*(?:GH_TOKEN|github\.token)/u);
  });

  it('runs deep checks nightly and cold-stack acceptance without retries', () => {
    const nightly = workflow('nightly-tests.yml');
    const acceptance = workflow('e2e-acceptance.yml');

    expect(nightly).toContain('npm run test:mutation');
    expect(nightly).toContain('--repeat-each=20');
    expect(nightly.match(/project: chromium-desktop/gu)).toHaveLength(3);
    expect(nightly.match(/project: chromium-mobile/gu)).toHaveLength(2);
    expect(nightly).toContain('--shard=1/3');
    expect(nightly).toContain('--shard=2/3');
    expect(nightly).toContain('--shard=3/3');
    expect(nightly).toContain('--shard=1/2');
    expect(nightly).toContain('--shard=2/2');
    expect(nightly).toContain('firefox-nightly');
    expect(nightly).toContain('webkit-nightly');
    expect(acceptance).toContain('cron: "23 3 * * 0"');
    expect(acceptance).not.toContain('pull_request:');
    expect(acceptance).toContain('shard: [1, 2, 3, 4]');
    expect(acceptance).toContain('shard: [1, 2, 3, 4, 5]');
    expect(acceptance).toContain('first_iteration=$(( (ACCEPTANCE_SHARD - 1) * 5 + 1 ))');
    expect(acceptance).toContain('first_iteration=$(( (ACCEPTANCE_SHARD - 1) * 6 + 1 ))');
    expect(acceptance).toContain('supabase db reset --local --no-seed');
    expect(acceptance).toContain('supabase stop --no-backup');
    expect(acceptance).toContain('E2E_REUSE_SERVER: "0"');
    expect(acceptance.match(/--workers=1 --retries=0/gu)).toHaveLength(2);
    expect(acceptance).toContain('--suite critical-repeat');
    expect(acceptance).toContain('--suite cold-stack');
    expect(acceptance.match(/--grep '@acceptance'/gu)).toHaveLength(2);
    expect(acceptance).toContain('Verify exactly 20 critical repetitions');
    expect(acceptance).toContain('Verify exactly 30 independent cold stacks');
    expect(acceptance).toContain('retention-days: 90');
    expect(`${nightly}\n${acceptance}`).not.toMatch(/retries?:\s*[1-9]/u);
  });
});
