import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolve } from 'node:path';
import { runBenchmark } from '../run.mjs';

const mocks = vi.hoisted(() => ({
  build: vi.fn(),
  preview: vi.fn(),
  serverClose: vi.fn(),
  open: vi.fn(),
  close: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  readFile: vi.fn(),
  readdir: vi.fn(),
  execute: vi.fn(),
  newPage: vi.fn(),
  on: vi.fn(),
  goto: vi.fn(),
  evaluate: vi.fn(),
  wait: vi.fn(),
  screenshot: vi.fn(),
  bringToFront: vi.fn(),
  mouseMove: vi.fn(),
  mouseDown: vi.fn(),
  mouseUp: vi.fn(),
  mouseWheel: vi.fn(),
}));
vi.mock('vite', () => ({ build: mocks.build, preview: mocks.preview }));
vi.mock('../environment.mjs', () => ({ openBenchmarkEnvironment: mocks.open }));
vi.mock('node:fs/promises', () => mocks);
vi.mock('node:child_process', () => ({
  execFile: Object.assign(mocks.execute, {
    [Symbol.for('nodejs.util.promisify.custom')]: (...args: unknown[]) =>
      new Promise((resolve, reject) => {
        mocks.execute(...args, (error: Error | null, stdout: string) =>
          error ? reject(error) : resolve({ stdout })
        );
      }),
  }),
}));

const environment = {
  batterySaverModeState: 0,
  battery: { EstimatedChargeRemaining: 14 },
  backgroundThrottlingDisabled: true,
};
let metadata: Record<string, unknown>;
let sample: Record<string, unknown>;
let quality: Record<string, unknown>;
const platformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform')!;
const setPlatform = (value: string) =>
  Object.defineProperty(process, 'platform', { value, configurable: true });
const report = () => JSON.parse(mocks.writeFile.mock.calls.at(-1)![1]);
const originalArgv = process.argv;
const originalExitCode = process.exitCode;

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('CITY_DESIGN_BENCH_DURATION_MS', '1000');
  vi.stubEnv('CITY_DESIGN_BENCH_REPEATS', '1');
  vi.stubEnv('CITY_DESIGN_BENCH_RESUME', '0');
  setPlatform('win32');
  let clock = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => (clock += 500));
  const nativeTimeout = globalThis.setTimeout;
  vi.spyOn(globalThis, 'setTimeout').mockImplementation(((callback: () => void, delay: number) => {
    if (delay === 10000) {
      queueMicrotask(callback);
      return 0;
    }
    return nativeTimeout(callback, delay);
  }) as typeof setTimeout);
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  mocks.serverClose.mockImplementation(callback => callback());
  mocks.preview.mockResolvedValue({ httpServer: { close: mocks.serverClose } });
  mocks.readdir.mockImplementation(path =>
    String(path).endsWith('assets')
      ? ['b.js', 'a.js', 'ignored.css']
      : ['b.ts', 'a.ts', 'ignored.json']
  );
  mocks.readFile.mockResolvedValue('source');
  mocks.execute.mockImplementation((_command, _args, ...rest) => rest.at(-1)(null, '0', ''));
  sample = {
    cameraMoved: true,
    averageFps: 60,
    frameP95: 16,
    frameP99: 20,
    callsP95: 100,
    durationMs: 1000,
    visibility: 'visible',
    documentHasFocus: false,
  };
  quality = { moving: false, pixelRatio: 1.5 };
  vi.stubGlobal('window', {
    streetPerformance: {
      mount: (count: number, width: number, height: number) => {
        metadata = { count, width, height, gpu: 'Radeon 780M', devicePixelRatio: 2 };
        return metadata;
      },
      begin: vi.fn(),
      end: () => ({ ...sample }),
      quality: () => ({ ...quality }),
      interactions: () => ({ selectionP95: 10, previewP95: 12, insertionP95: 15 }),
    },
  });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  mocks.evaluate.mockImplementation((callback, argument) => callback(argument));
  mocks.wait.mockImplementation(callback => {
    if (typeof callback === 'function') return callback();
  });
  mocks.newPage.mockResolvedValue({
    on: mocks.on,
    goto: mocks.goto,
    evaluate: mocks.evaluate,
    waitForFunction: mocks.wait,
    waitForTimeout: mocks.wait,
    screenshot: mocks.screenshot,
    bringToFront: mocks.bringToFront,
    locator: () => ({ boundingBox: async () => ({ x: 10, y: 20, width: 1100, height: 720 }) }),
    mouse: {
      move: mocks.mouseMove,
      down: mocks.mouseDown,
      up: mocks.mouseUp,
      wheel: mocks.mouseWheel,
    },
  });
  mocks.open.mockResolvedValue({
    browser: { newPage: mocks.newPage },
    benchmarkEnvironment: environment,
    close: mocks.close,
  });
});
afterEach(() => {
  Object.defineProperty(process, 'platform', platformDescriptor);
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  process.argv = originalArgv;
  process.exitCode = originalExitCode;
});

describe('camera benchmark orchestration', () => {
  it('uses the default duration and five repetitions when no overrides are supplied', async () => {
    vi.stubEnv('CITY_DESIGN_BENCH_DURATION_MS', undefined);
    vi.stubEnv('CITY_DESIGN_BENCH_REPEATS', undefined);
    expect(await runBenchmark()).toBe(0);
    expect(report()).toMatchObject({
      duration: 10000,
      repeats: 5,
      expectedSamples: 33,
      complete: true,
    });
  });

  it('runs the CLI entry point and sets its exit code', async () => {
    process.argv = [process.argv[0]!, resolve('tools/testing/performance/city-design/run.mjs')];
    vi.resetModules();
    await import('../run.mjs');
    expect(process.exitCode).toBe(0);
    expect(report().complete).toBe(true);
  });
  it('runs all scenarios, saves environment and focus telemetry, then closes browser and preview', async () => {
    expect(await runBenchmark()).toBe(0);
    const result = report();
    expect(result).toMatchObject({
      expectedSamples: 9,
      complete: true,
      failure: null,
      benchmarkEnvironment: environment,
    });
    expect(result.results).toHaveLength(9);
    expect(result.interactions).toHaveLength(3);
    expect(result.results.every((value: { accepted: boolean }) => value.accepted)).toBe(true);
    expect(result.results[0]).toMatchObject({ visibility: 'visible', documentHasFocus: false });
    expect(mocks.mouseDown).toHaveBeenCalledWith({ button: 'right' });
    expect(mocks.mouseDown).toHaveBeenCalledWith({ button: 'left' });
    expect(mocks.mouseUp).toHaveBeenCalledWith({ button: 'right' });
    expect(mocks.mouseUp).toHaveBeenCalledWith({ button: 'left' });
    expect(mocks.mouseWheel).toHaveBeenCalled();
    expect(mocks.bringToFront).toHaveBeenCalledTimes(9);
    expect(mocks.screenshot).toHaveBeenCalledOnce();
    expect(mocks.close).toHaveBeenCalledOnce();
    expect(mocks.serverClose).toHaveBeenCalledOnce();
    expect(mocks.goto).toHaveBeenCalledWith('http://127.0.0.1:4321');
  });

  it.each([
    ['cameraMoved', false],
    ['averageFps', 57.9],
    ['frameP95', 20.1],
    ['frameP99', 33.4],
    ['moving', true],
    ['pixelRatio', 1],
  ])('fails acceptance when %s is %s', async (field, value) => {
    if (field in quality) quality[field] = value;
    else sample[field] = value;
    expect(await runBenchmark()).toBe(1);
    expect(report().results.every((value: { accepted: boolean }) => !value.accepted)).toBe(true);
  });

  it('accepts inclusive FPS and percentile boundaries', async () => {
    Object.assign(sample, { averageFps: 58, frameP95: 20, frameP99: 33.3 });
    expect(await runBenchmark()).toBe(0);
  });

  it('discards a sample interrupted by a long system pause and repeats it', async () => {
    const evaluate = mocks.evaluate.getMockImplementation()!;
    let interrupted = false;
    mocks.evaluate.mockImplementation((callback, argument) => {
      if (!interrupted && String(callback).includes('.end()')) {
        interrupted = true;
        return { ...sample, durationMs: 6001 };
      }
      return evaluate(callback, argument);
    });
    expect(await runBenchmark()).toBe(0);
    expect(report().results).toHaveLength(9);
    expect(mocks.bringToFront).toHaveBeenCalledTimes(10);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('interruption'));
  });

  it('waits for concurrent tests and discards a measurement if tests start during it', async () => {
    const responses = ['1', '1', '0', '0', '1', '0'];
    mocks.execute.mockImplementation((_command, _args, ...rest) =>
      rest.at(-1)(null, responses.shift() ?? '0', '')
    );
    expect(await runBenchmark()).toBe(0);
    expect(mocks.bringToFront).toHaveBeenCalledTimes(10);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('concurrent tests started'));
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Waiting for concurrent tests')
    );
  });

  it('checks concurrent tests with ps on non-Windows hosts', async () => {
    setPlatform('linux');
    mocks.execute.mockImplementationOnce((_command, _args, callback) =>
      callback(null, 'node vitest.mjs run', '')
    );
    expect(await runBenchmark()).toBe(0);
    expect(mocks.execute).toHaveBeenCalledWith('ps', ['-eo', 'args'], expect.any(Function));
  });

  it.each(['software rendering', 'page error', 'source changed', 'browser startup'])(
    'persists failure and cleans up after %s',
    async failure => {
      if (failure === 'software rendering') {
        const evaluate = mocks.evaluate.getMockImplementation()!;
        mocks.evaluate.mockImplementation((callback, argument) => {
          const value = evaluate(callback, argument);
          return String(callback).includes('.mount(') ? { ...value, gpu: 'SwiftShader' } : value;
        });
      } else if (failure === 'page error')
        mocks.on.mockImplementation((_event, callback) => callback(new Error('page error')));
      else if (failure === 'source changed') {
        let reads = 0;
        mocks.readFile.mockImplementation(() => (++reads <= 6 ? 'source' : 'changed'));
      } else mocks.open.mockRejectedValueOnce(new Error('browser startup'));
      expect(await runBenchmark()).toBe(1);
      expect(report()).toMatchObject({ complete: false, failure: expect.any(String) });
      expect(mocks.serverClose).toHaveBeenCalledOnce();
      expect(mocks.close.mock.calls.length).toBe(failure === 'browser startup' ? 0 : 1);
    }
  );

  it('cleans up the browser and server even if writing the report fails', async () => {
    mocks.writeFile.mockRejectedValue(new Error('disk full'));
    await expect(runBenchmark()).rejects.toThrow('disk full');
    expect(mocks.close).toHaveBeenCalledOnce();
    expect(mocks.serverClose).toHaveBeenCalledOnce();
  });

  it('closes the preview even if browser cleanup fails', async () => {
    mocks.close.mockRejectedValueOnce(new Error('browser close'));
    await expect(runBenchmark()).rejects.toThrow('browser close');
    expect(mocks.serverClose).toHaveBeenCalledOnce();
  });

  it('resumes accepted samples and existing interactions without duplicating them', async () => {
    await runBenchmark();
    const previous = report();
    previous.results[0].accepted = false;
    vi.stubEnv('CITY_DESIGN_BENCH_RESUME', '1');
    mocks.readFile.mockImplementation(path =>
      String(path).endsWith('results.json') ? JSON.stringify(previous) : 'source'
    );
    mocks.bringToFront.mockClear();
    expect(await runBenchmark()).toBe(0);
    expect(report().results).toHaveLength(9);
    expect(report().interactions).toHaveLength(3);
    expect(report()).toMatchObject({
      resumed: true,
      benchmarkEnvironmentHistory: [environment, environment],
    });
    expect(mocks.bringToFront).toHaveBeenCalledOnce();
  });

  it('preserves the environment from older reports without an environment history', async () => {
    await runBenchmark();
    const previous = report();
    delete previous.benchmarkEnvironmentHistory;
    previous.benchmarkEnvironment = { ...environment, battery: { EstimatedChargeRemaining: 7 } };
    vi.stubEnv('CITY_DESIGN_BENCH_RESUME', '1');
    mocks.readFile.mockImplementation(path =>
      String(path).endsWith('results.json') ? JSON.stringify(previous) : 'source'
    );
    expect(await runBenchmark()).toBe(0);
    expect(report().benchmarkEnvironmentHistory).toEqual([
      previous.benchmarkEnvironment,
      environment,
    ]);
  });

  it.each(['productionSourceHash', 'duration', 'repeats'])(
    'rejects a resumed run with a different %s',
    async field => {
      await runBenchmark();
      const previous = report();
      previous[field] = 'different';
      vi.stubEnv('CITY_DESIGN_BENCH_RESUME', '1');
      mocks.readFile.mockImplementation(path =>
        String(path).endsWith('results.json') ? JSON.stringify(previous) : 'source'
      );
      mocks.open.mockClear();
      await expect(runBenchmark()).rejects.toThrow('Cannot resume');
      expect(mocks.open).not.toHaveBeenCalled();
    }
  );
});
