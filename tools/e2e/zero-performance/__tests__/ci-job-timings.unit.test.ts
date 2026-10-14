import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ciJobs } from '../ci-job-timings';

const jobs = Array.from({ length: 102 }, (_, id) => ({ id, name: `job-${id}` }));
const response = (rows: unknown[] = jobs, total = rows.length) =>
  new Response(JSON.stringify({ jobs: rows, total_count: total }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'performance'] });
  vi.stubEnv('GITHUB_ACTIONS', 'true');
  vi.stubEnv('GH_TOKEN', 'read-only-token');
  vi.stubEnv('GITHUB_TOKEN', 'fallback-token');
  vi.stubEnv('GITHUB_REPOSITORY', 'polity-live/polity');
  vi.stubEnv('GITHUB_RUN_ID', '38461817406');
  vi.stubEnv('GITHUB_RUN_ATTEMPT', '2');
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('native CI timing retrieval', () => {
  it('does not contact GitHub outside native CI', async () => {
    vi.stubEnv('GITHUB_ACTIONS', '');
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect(await ciJobs(NaN)).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('recovers a transient 502 on page two without duplicating page one or changing attempt', async () => {
    const fetch = vi
      .fn()
      .mockImplementationOnce(async () => {
        vi.stubEnv('GITHUB_RUN_ID', '999');
        vi.stubEnv('GITHUB_RUN_ATTEMPT', '3');
        return response(jobs.slice(0, 100), 102);
      })
      .mockResolvedValueOnce(new Response('', { status: 502 }))
      .mockResolvedValueOnce(response(jobs.slice(100), 102));
    vi.stubGlobal('fetch', fetch);
    const result = ciJobs(120_000);
    await vi.runAllTimersAsync();
    expect(await result).toEqual(jobs);
    expect(fetch.mock.calls.map(call => call[0])).toEqual([
      'https://api.github.com/repos/polity-live/polity/actions/runs/38461817406/attempts/2/jobs?per_page=100&page=1',
      'https://api.github.com/repos/polity-live/polity/actions/runs/38461817406/attempts/2/jobs?per_page=100&page=2',
      'https://api.github.com/repos/polity-live/polity/actions/runs/38461817406/attempts/2/jobs?per_page=100&page=2',
    ]);
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer read-only-token');
  });

  it.each([408, 500, 503, 504])(
    'retries transient HTTP %s and retains real evidence',
    async status => {
      const fetch = vi
        .fn()
        .mockResolvedValueOnce(new Response('', { status }))
        .mockResolvedValueOnce(response(jobs.slice(0, 1)));
      vi.stubGlobal('fetch', fetch);
      const result = ciJobs(120_000);
      await vi.runAllTimersAsync();
      expect(await result).toEqual(jobs.slice(0, 1));
      expect(fetch).toHaveBeenCalledTimes(2);
    }
  );

  it.each([
    new TypeError('fetch failed'),
    new DOMException('timed out', 'TimeoutError'),
    new DOMException('aborted', 'AbortError'),
  ])('recovers a transient transport error: %s', async error => {
    const fetch = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce(response([]));
    vi.stubGlobal('fetch', fetch);
    const result = ciJobs(120_000);
    await vi.runAllTimersAsync();
    expect(await result).toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it.each([401, 403, 404])('never retries permanent HTTP %s', async status => {
    const fetch = vi.fn().mockResolvedValue(new Response('', { status }));
    vi.stubGlobal('fetch', fetch);
    await expect(ciJobs(120_000)).rejects.toThrow(`HTTP ${status}`);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('fails after three transient requests without inventing timing success', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('', { status: 502 }));
    vi.stubGlobal('fetch', fetch);
    const failure = expect(ciJobs(120_000)).rejects.toThrow('HTTP 502');
    await vi.runAllTimersAsync();
    await failure;
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('uses the fallback token and accepts a complete exact-size page', async () => {
    vi.stubEnv('GH_TOKEN', undefined);
    const fetch = vi.fn().mockResolvedValue(response(jobs.slice(0, 100)));
    vi.stubGlobal('fetch', fetch);
    expect(await ciJobs(120_000)).toEqual(jobs.slice(0, 100));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer fallback-token');
  });

  it.each([
    ['GH_TOKEN', undefined, 'GITHUB_TOKEN', undefined],
    ['GITHUB_REPOSITORY', undefined],
    ['GITHUB_REPOSITORY', 'invalid/repo/extra'],
    ['GITHUB_RUN_ID', undefined],
    ['GITHUB_RUN_ID', 'not-a-run'],
    ['GITHUB_RUN_ATTEMPT', undefined],
    ['GITHUB_RUN_ATTEMPT', '0'],
  ])(
    'rejects missing or invalid scope: %s',
    async (key, value, otherKey?: string, otherValue?: string) => {
      vi.stubEnv(key!, value);
      if (otherKey) vi.stubEnv(otherKey, otherValue);
      const fetch = vi.fn();
      vi.stubGlobal('fetch', fetch);
      await expect(ciJobs(120_000)).rejects.toThrow('CI timing context');
      expect(fetch).not.toHaveBeenCalled();
    }
  );

  it.each([NaN, Infinity, 1000, 0])('refuses an unavailable merge budget: %s', async remaining => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(ciJobs(remaining)).rejects.toThrow('deadline exceeded');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not sleep past the remaining merge budget', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('', { status: 502 }));
    vi.stubGlobal('fetch', fetch);
    await expect(ciJobs(1400)).rejects.toThrow('deadline exceeded');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects a request completing after the reserved retrieval deadline', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        await vi.advanceTimersByTimeAsync(45_001);
        return response([]);
      })
    );
    await expect(ciJobs(120_000)).rejects.toThrow('deadline exceeded');
  });

  it('stops before fetching the next page once the global deadline is consumed', async () => {
    const fetch = vi.fn().mockResolvedValue(response(jobs.slice(0, 100), 102));
    vi.stubGlobal('fetch', fetch);
    // Advance after the successful page validation and before the next request clock read.
    const now = vi.spyOn(performance, 'now');
    now
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(44_999)
      .mockReturnValue(45_000);
    await expect(ciJobs(120_000)).rejects.toThrow('deadline exceeded');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed JSON without retrying', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{invalid'));
    vi.stubGlobal('fetch', fetch);
    await expect(ciJobs(120_000)).rejects.toBeInstanceOf(SyntaxError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    null,
    { jobs: null, total_count: 1 },
    { jobs, total_count: 102 },
    { jobs: [], total_count: -1 },
    { jobs: [], total_count: 0.5 },
    { jobs: jobs.slice(0, 2), total_count: 1 },
    { jobs: jobs.slice(0, 1), total_count: 2 },
  ])('rejects inconsistent or incomplete pagination: %j', async body => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(body)));
    vi.stubGlobal('fetch', fetch);
    await expect(ciJobs(120_000)).rejects.toThrow('CI timing pagination');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects a changed job inventory between pages', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response(jobs.slice(0, 100), 102))
      .mockResolvedValueOnce(response(jobs.slice(100), 103));
    vi.stubGlobal('fetch', fetch);
    await expect(ciJobs(120_000)).rejects.toThrow('Invalid/inconsistent CI timing pagination');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
