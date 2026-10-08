import { build, preview } from 'vite';
import { openBenchmarkEnvironment } from './environment.mjs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export async function runBenchmark() {
  const configFile = resolve(import.meta.dirname, 'vite.config.mjs');
  const artifactDir = resolve(
    import.meta.dirname,
    '../../../../output/playwright/city-design-performance'
  );
  const duration = Number(process.env.CITY_DESIGN_BENCH_DURATION_MS ?? 10000);
  const repeats = Number(process.env.CITY_DESIGN_BENCH_REPEATS ?? 5);
  const resume = process.env.CITY_DESIGN_BENCH_RESUME === '1';
  const reportPath = resolve(artifactDir, 'results.json');
  const expectedSamples = repeats * 6 + 3;
  const execute = promisify(execFile);
  async function testProcessesActive() {
    const { stdout } =
      process.platform === 'win32'
        ? await execute(
            'powershell.exe',
            [
              '-NoProfile',
              '-Command',
              "@(Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -match 'vitest.mjs.*\\brun\\b|playwright.*\\btest\\b' }).Count",
            ],
            { windowsHide: true }
          )
        : await execute('ps', ['-eo', 'args']);
    const active =
      process.platform === 'win32'
        ? Number(stdout.trim()) > 0
        : /vitest(?:\.mjs)? .*\brun\b|playwright .*\btest\b/.test(stdout);
    return active;
  }
  async function waitForTestProcesses() {
    let announced = false;
    for (;;) {
      if (!(await testProcessesActive())) return;
      if (!announced) {
        console.log('Waiting for concurrent tests to finish before the hardware measurements.');
        announced = true;
      }
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
  async function sourceHash() {
    const directory = resolve(
      import.meta.dirname,
      '../../../../src/features/amendments/city-design/logic'
    );
    const files = (await readdir(directory))
      .filter(file => file.endsWith('.ts'))
      .sort()
      .map(file => resolve(directory, file));
    files.push(
      resolve(directory, '../types.ts'),
      resolve(directory, '../state/cityDesignReducer.ts'),
      resolve(directory, '../../../app-tutorial/city-design-fixture.ts'),
      resolve(import.meta.dirname, 'main.js')
    );
    const hash = createHash('sha256');
    for (const file of files) hash.update(await readFile(file));
    return hash.digest('hex');
  }
  async function buildHash() {
    const assets = resolve(artifactDir, 'build/assets');
    const files = (await readdir(assets)).filter(file => file.endsWith('.js')).sort();
    const hash = createHash('sha256');
    for (const file of files) hash.update(await readFile(resolve(assets, file)));
    return hash.digest('hex');
  }
  const previous = resume ? JSON.parse(await readFile(reportPath, 'utf8')) : null;
  const environmentHistory =
    previous?.benchmarkEnvironmentHistory ??
    (previous?.benchmarkEnvironment ? [previous.benchmarkEnvironment] : []);
  await waitForTestProcesses();
  const productionSourceHash = await sourceHash();
  await build({ configFile });
  const productionBuildHash = await buildHash();
  if (
    resume &&
    (previous.productionSourceHash !== productionSourceHash ||
      previous.duration !== duration ||
      previous.repeats !== repeats)
  )
    throw new Error(
      'Cannot resume a different production build or benchmark configuration. Run without CITY_DESIGN_BENCH_RESUME.'
    );
  const server = await preview({ configFile });
  let environment;
  let benchmarkEnvironment = null;
  let failure = null;
  const results = previous?.results.filter(result => result.accepted) ?? [];
  const interactions = previous?.interactions ?? [];
  const errors = [];
  const key = result =>
    `${result.width}:${result.height}:${result.count}:${result.repetition}:${result.kind}`;
  const completed = new Set(results.map(key));
  async function save() {
    await mkdir(artifactDir, { recursive: true });
    await writeFile(
      reportPath,
      JSON.stringify(
        {
          measuredAt: new Date().toISOString(),
          productionBuildHash,
          productionSourceHash,
          duration,
          repeats,
          expectedSamples,
          complete: results.length === expectedSamples && !failure,
          failure,
          benchmarkEnvironment,
          benchmarkEnvironmentHistory: [...environmentHistory, benchmarkEnvironment],
          resumed: resume,
          results,
          interactions,
        },
        null,
        2
      )
    );
  }

  async function gesture(page, kind, milliseconds, measured) {
    const bounds = await page.locator('canvas').boundingBox();
    const x = bounds.x + bounds.width / 2,
      y = bounds.y + bounds.height / 2;
    await page.mouse.move(x, y);
    if (kind !== 'zoom') await page.mouse.down({ button: kind === 'orbit' ? 'right' : 'left' });
    if (measured) await page.evaluate(() => window.streetPerformance.begin());
    const startedAt = performance.now();
    while (performance.now() - startedAt < milliseconds) {
      const seconds = (performance.now() - startedAt) / 1000;
      if (kind === 'zoom') await page.mouse.wheel(0, Math.sin(seconds * Math.PI) * 5);
      else
        await page.mouse.move(
          x + Math.sin(seconds * Math.PI) * 90,
          y + Math.sin(seconds * Math.PI * 0.5) * 30
        );
      await page.waitForTimeout(8);
    }
    if (kind !== 'zoom') await page.mouse.up({ button: kind === 'orbit' ? 'right' : 'left' });
    const result = measured ? await page.evaluate(() => window.streetPerformance.end()) : null;
    await page.waitForFunction(() => !window.streetPerformance.quality().moving);
    await page.evaluate(
      () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    );
    return result;
  }

  try {
    environment = await openBenchmarkEnvironment(artifactDir);
    benchmarkEnvironment = environment.benchmarkEnvironment;
    const page = await environment.browser.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:4321');
    await page.waitForFunction(() => window.streetPerformance);
    for (const [width, height, counts, repetitions] of [
      [1100, 720, [100, 500], repeats],
      [1920, 1080, [500], 1],
    ]) {
      for (const count of counts) {
        for (let repetition = 1; repetition <= repetitions; repetition++) {
          const kinds = ['orbit', 'pan', 'zoom'].filter(
            kind => !completed.has(key({ count, width, height, repetition, kind }))
          );
          if (!kinds.length) continue;
          const metadata = await page.evaluate(
            ({ count, width, height }) => window.streetPerformance.mount(count, width, height),
            { count, width, height }
          );
          if (/swiftshader|software/i.test(metadata.gpu))
            throw new Error(`Hardware acceleration required: ${metadata.gpu}`);
          for (const kind of kinds) {
            let sample;
            for (;;) {
              await waitForTestProcesses();
              await page.bringToFront();
              await gesture(page, kind, 1000, false);
              sample = await gesture(page, kind, duration, true);
              if (sample.durationMs > duration + 5000) {
                console.log(
                  `Discarding ${kind} sample after an interruption (${sample.durationMs.toFixed(0)} ms); retrying.`
                );
                continue;
              }
              if (!(await testProcessesActive())) break;
              console.log(
                `Discarding ${kind} sample because concurrent tests started; retrying after they finish.`
              );
            }
            const quality = await page.evaluate(() => window.streetPerformance.quality());
            if (errors.length) throw new Error(errors.join('\n'));
            const accepted =
              sample.cameraMoved &&
              sample.averageFps >= 58 &&
              sample.frameP95 <= 20 &&
              sample.frameP99 <= 33.3 &&
              !quality.moving &&
              quality.pixelRatio === Math.min(metadata.devicePixelRatio, 1.5);
            results.push({
              ...metadata,
              repetition,
              kind,
              ...sample,
              restoredQuality: quality,
              accepted,
            });
            await save();
            console.log(
              `${count} ${width}x${height} ${kind} #${repetition}: ${sample.averageFps.toFixed(1)} FPS, P95 ${sample.frameP95.toFixed(1)} ms, P99 ${sample.frameP99.toFixed(1)} ms, ${sample.callsP95} calls, ${accepted ? 'PASS' : 'FAIL'}`
            );
          }
          if (
            repetition === 1 &&
            !interactions.some(
              result => result.width === width && result.height === height && result.count === count
            )
          )
            interactions.push({
              ...metadata,
              ...(await page.evaluate(() => window.streetPerformance.interactions())),
            });
        }
      }
    }
    if ((await sourceHash()) !== productionSourceHash)
      throw new Error('Scene source changed during the hardware benchmark; rerun the final build.');
    await page.screenshot({ path: resolve(artifactDir, 'scene.png') });
  } catch (error) {
    failure = String(error);
    console.error(failure);
  } finally {
    try {
      await save();
    } finally {
      try {
        await environment?.close();
      } finally {
        await new Promise(resolve => server.httpServer.close(resolve));
      }
    }
  }
  if (failure || results.length !== expectedSamples || results.some(result => !result.accepted))
    return 1;
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  process.exitCode = await runBenchmark();
