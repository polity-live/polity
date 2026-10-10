import { readFile } from 'node:fs/promises';
const { navigationMaterializationFailures } = await import('../tools/e2e/zero-performance/report.ts');
const report = JSON.parse(await readFile('output/zero-performance/validated-journeys-v7-1/workers/journeys/progress.json', 'utf8'));
const visits = report.journeys.filter(row => ['first', 'back', 'repeat'].includes(row.visit));
console.log(JSON.stringify({ format:report.format, protocol:report.protocol, visits:visits.length, failures:visits.flatMap(navigationMaterializationFailures), timings:visits.map(row=>({route:row.route,visit:row.visit,visible:row.visibleMs,authoritative:row.authoritativeMs})), other:report.journeys.filter(row=>!['first','back','repeat'].includes(row.visit)).map(row=>({visit:row.visit,visible:row.visibleMs,failures:row.failures})) },null,2));
