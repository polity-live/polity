import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createCoverageMap } = require(
  require.resolve('istanbul-lib-coverage', {
    paths: [path.dirname(require.resolve('@vitest/coverage-v8'))],
  })
);

export function mergeCoverageProjects(reportPaths, outputDirectory) {
  if (reportPaths.length < 3)
    throw new Error('Base, browser and database coverage reports are required.');
  const merged = createCoverageMap({});
  for (const reportPath of reportPaths) {
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    if (Object.keys(report).length === 0) throw new Error(`Empty coverage report: ${reportPath}`);
    merged.merge(report);
  }
  const summary = { total: merged.getCoverageSummary().toJSON() };
  for (const file of merged.files())
    summary[file] = merged.fileCoverageFor(file).toSummary().toJSON();
  fs.mkdirSync(outputDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(outputDirectory, 'coverage-final.json'),
    JSON.stringify(merged.toJSON())
  );
  fs.writeFileSync(path.join(outputDirectory, 'coverage-summary.json'), JSON.stringify(summary));
  return summary.total;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  mergeCoverageProjects(process.argv.slice(3), process.argv[2]);
}
