const TRANSIENT_HTTP = new Set([408, 500, 502, 503, 504]);
const PAGE_SIZE = 100;

class TimingHTTPError extends Error {
  constructor(readonly status: number) {
    super(`Cannot read CI job timings: HTTP ${status}`);
  }
}

/** Read the complete current attempt. Missing timing evidence remains a gate error. */
export async function ciJobs(remainingMergeMs: number): Promise<any[] | undefined> {
  if (!process.env.GITHUB_ACTIONS) return undefined;
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  const run = process.env.GITHUB_RUN_ID;
  const attempt = process.env.GITHUB_RUN_ATTEMPT;
  if (
    !token ||
    !repository ||
    !run ||
    !attempt ||
    !/^[\w.-]+\/[\w.-]+$/.test(repository) ||
    !/^[1-9]\d*$/.test(run) ||
    !/^[1-9]\d*$/.test(attempt)
  )
    throw new Error('Missing/invalid read-only CI timing context');
  if (!Number.isFinite(remainingMergeMs) || remainingMergeMs <= 1000)
    throw new Error('CI timing retrieval deadline exceeded');
  // Leave time to write the gate artifact, without extending the existing merge budget.
  const deadline = performance.now() + Math.min(45_000, remainingMergeMs - 1000);
  const jobs: any[] = [];
  let total: number | undefined;
  for (let page = 1; ; page++) {
    let result: any;
    for (let retry = 1; ; retry++) {
      const remaining = deadline - performance.now();
      if (remaining <= 0) throw new Error('CI timing retrieval deadline exceeded');
      try {
        const response = await fetch(
          `https://api.github.com/repos/${repository}/actions/runs/${run}/attempts/${attempt}/jobs?per_page=${PAGE_SIZE}&page=${page}`,
          {
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
            signal: AbortSignal.timeout(Math.max(1, Math.ceil(Math.min(15_000, remaining)))),
          }
        );
        if (!response.ok) throw new TimingHTTPError(response.status);
        result = await response.json();
        if (performance.now() >= deadline) throw new Error('CI timing retrieval deadline exceeded');
        break;
      } catch (error) {
        const transient =
          error instanceof TimingHTTPError
            ? TRANSIENT_HTTP.has(error.status)
            : error instanceof TypeError ||
              (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name));
        if (!transient || retry === 3) throw error;
        const delay = retry * 500;
        if (deadline - performance.now() <= delay)
          throw new Error('CI timing retrieval deadline exceeded', { cause: error });
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    if (
      !result ||
      !Array.isArray(result.jobs) ||
      result.jobs.length > PAGE_SIZE ||
      !Number.isSafeInteger(result.total_count) ||
      result.total_count < 0 ||
      (total !== undefined && total !== result.total_count)
    )
      throw new Error('Invalid/inconsistent CI timing pagination');
    total = result.total_count as number;
    jobs.push(...result.jobs);
    if (jobs.length > total || (result.jobs.length < PAGE_SIZE && jobs.length !== total))
      throw new Error('Incomplete CI timing pagination');
    if (jobs.length === total) return jobs;
  }
}
