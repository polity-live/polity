import { ACTIVE_BUDGET_MS } from './sharding';

export interface JobTiming {
  name: string;
  started_at: string;
  completed_at: string;
  steps: { name: string; started_at: string; completed_at: string }[];
}

export function activeTiming(prepareMs: number, runnersMs: number, mergeMs: number) {
  const activeMs = prepareMs + runnersMs + mergeMs;
  const failed =
    [prepareMs, runnersMs, mergeMs, activeMs].some(value => !Number.isFinite(value) || value < 0) ||
    prepareMs > ACTIVE_BUDGET_MS.prepare ||
    runnersMs > ACTIVE_BUDGET_MS.runner ||
    mergeMs > ACTIVE_BUDGET_MS.merge ||
    activeMs > 1_200_000;
  return { prepareMs, runnersMs, mergeMs, activeMs, activeBudgetMs: 1_200_000, failed };
}

export function nativeTiming(jobs: JobTiming[], mergeMs: number, shardIDs: string[]) {
  const preparation = jobs.filter(job => job.name === 'Zero preparation');
  const runners = jobs.filter(job => job.name.startsWith('Zero measurements / '));
  if (
    preparation.length !== 1 ||
    runners.length !== shardIDs.length ||
    shardIDs.some(
      id => runners.filter(job => job.name === `Zero measurements / ${id}`).length !== 1
    )
  )
    throw new Error('Incomplete/duplicate native CI timing records');
  const elapsed = (job: JobTiming) => Date.parse(job.completed_at) - Date.parse(job.started_at);
  const result = activeTiming(elapsed(preparation[0]), Math.max(...runners.map(elapsed)), mergeMs);
  return {
    ...result,
    queueByRunnerMs: runners.map(job => ({
      shard: job.name,
      queuedMs: Math.max(0, Date.parse(job.started_at) - Date.parse(preparation[0].completed_at)),
    })),
    artifactByRunnerMs: runners.map(job => ({
      shard: job.name,
      artifactMs: job.steps
        .filter(step => /Upload|Stage benchmark artifacts/.test(step.name))
        .reduce(
          (sum, step) => sum + Date.parse(step.completed_at) - Date.parse(step.started_at),
          0
        ),
    })),
  };
}
