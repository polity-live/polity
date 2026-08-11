import fs from 'node:fs';
import path from 'node:path';

const summaryPath = path.resolve('coverage/coverage-summary.json');
const baselinePath = path.join(import.meta.dirname, 'coverage-ratchet.json');

if (!fs.existsSync(summaryPath)) {
  console.error('Missing coverage/coverage-summary.json. Run npm run test:coverage first.');
  process.exit(1);
}

const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
const total = summary.total;
const metrics = ['lines', 'statements', 'functions', 'branches'];
const current = Object.fromEntries(
  metrics.map(metric => [metric, { covered: total[metric].covered, total: total[metric].total }])
);

if (process.argv.includes('--update')) {
  fs.writeFileSync(baselinePath, `${JSON.stringify({ version: 1, metrics: current }, null, 2)}\n`);
  console.info('Coverage ratchet baseline updated.');
  process.exit(0);
}

if (!fs.existsSync(baselinePath)) {
  console.error('Coverage ratchet baseline is missing.');
  process.exit(1);
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8')).metrics;
const failures = [];
for (const metric of metrics) {
  const uncovered = current[metric].total - current[metric].covered;
  const allowed = baseline[metric].total - baseline[metric].covered;
  if (uncovered > allowed)
    failures.push(`${metric}: ${uncovered} uncovered exceeds baseline ${allowed}`);
  console.info(
    `${metric}: ${current[metric].covered}/${current[metric].total}; debt ${uncovered}/${allowed}`
  );
}

if (failures.length) {
  console.error(`Coverage ratchet failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
