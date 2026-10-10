import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  mutationWeightCLIOptions,
  updateMutationSchedulingWeights,
} from './mutation-scheduling-weights';

export async function updateMutationWeightFiles(args: readonly string[]) {
  const options = mutationWeightCLIOptions(args);
  const base = JSON.parse(await readFile(options.weights, 'utf8'));
  const reports = await Promise.all(
    options.reports.map(async file => JSON.parse(await readFile(file, 'utf8')))
  );
  const result = updateMutationSchedulingWeights(base, reports);
  await mkdir(path.dirname(path.resolve(options.output)), { recursive: true });
  await writeFile(options.output, `${JSON.stringify(result.weights, null, 2)}\n`, 'utf8');
  return result;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await updateMutationWeightFiles(process.argv.slice(2))
    .then(result => {
      process.stdout.write(
        `${JSON.stringify({ acceptedMeasurements: result.acceptedMeasurements, ignoredMeasurements: result.ignoredMeasurements, updatedKeys: result.updatedKeys })}\n`
      );
    })
    .catch(error => {
      process.stderr.write(
        `${error instanceof Error ? error.message : 'Mutation scheduling-weight update failed'}\n`
      );
      process.exitCode = 1;
    });
}
