import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
const root = process.argv[2] ?? 'output/zero-performance/optimized-complete-v6-2';
const rows = readdirSync(path.join(root, 'workers')).flatMap(worker => {
  const file = path.join(root, 'workers', worker, 'measurements.ndjson');
  return existsSync(file) ? readFileSync(file, 'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse) : [];
});
const median = values => [...values].sort((a,b) => a-b)[Math.floor(values.length/2)];
const summaries = rows.map(row => ({ key: row.key, total: median(row.samples.map(sample=>sample.totalMs)), hydration: median(row.samples.map(sample=>sample.serverMs)), analyzer: [...row.analyzeMs].sort((a,b)=>a-b)[18], failures: row.failures }));
console.log(JSON.stringify({ count: rows.length, resultFailures: rows.flatMap(row=>(row.failures??[]).filter(f=>!/p95|exceeds|slow.query/i.test(f)).map(f=>({key:row.key,f}))).slice(0,10), top: summaries.sort((a,b)=>b.hydration-a.hydration).slice(0,12) },null,2));
