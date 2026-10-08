# Street Design camera benchmark

Run `pnpm run test:performance:city-design` on the target machine with hardware
acceleration enabled and no other tests or benchmarks running. The command builds
the actual scene renderer for production, serves it on `127.0.0.1:4321`, and opens
an isolated Chromium window. It closes its browser and preview server when done.
Before opening the browser, it waits for active Vitest or Playwright test runs to
finish so those runs cannot contaminate the hardware measurements.
It also checks between gestures and retries a sample if another test started.
Samples interrupted by a long system pause are discarded and repeated.
Chromium background throttling is disabled to keep the hardware measurements
independent of which desktop window has focus; hardware acceleration is retained.
Energy Saver is preconfigured as disabled in this disposable benchmark profile
only. The report records that setting and the Windows battery status.
The user's Chrome profile, PWAs and system power settings are unaffected. Chrome
Energy Saver reduces animation refresh rate independently of GPU render cost;
see [Chrome's explanation](https://developer.chrome.com/blog/memory-and-energy-saver-mode).

The default run uses 298 OSM features and mixed scenarios with 100 and 500 design
elements on a 1100 × 720 canvas. Each repetition warms up navigation, then measures
10 seconds each of orbit, pan and zoom. There are five repetitions per scenario,
followed by all three gestures at 1920 × 1080 with 500 elements: 33 samples total.

Each sample records the actual GPU, device pixel ratio, `WEBGL_multi_draw` support,
frame-time percentiles, average FPS, draw calls, triangles, CPU render duration and
available disjoint GPU timer queries. Software rendering is rejected. Selection,
placement preview and insertion latency are measured separately. Quality must
restore after damping finishes, including a completed restoration frame.

The acceptance thresholds are average FPS ≥ 58, P95 ≤ 20 ms and P99 ≤ 33.3 ms for
every sample. A failed threshold or incomplete run exits with a nonzero status.
Results are saved incrementally to
`output/playwright/city-design-performance/results.json`, together with source and
production-bundle hashes. The restored scene is saved as `scene.png`.

For a short smoke run, set `CITY_DESIGN_BENCH_DURATION_MS` and
`CITY_DESIGN_BENCH_REPEATS`. This does not replace the default acceptance run.
After an interrupted run, `CITY_DESIGN_BENCH_RESUME=1` reuses successful samples
only if the source hash, duration and repetition count still match.
The report retains each session's environment when resuming and records page
visibility and focus for every sample.

Run `pnpm run test:performance:city-design:coverage` to verify the benchmark
instrumentation and runner without starting a hardware measurement. Its unit tests
exercise scene callbacks, frame and GPU timing, profile isolation, battery status,
acceptance thresholds, interrupted samples, resume history and cleanup failures.
The dedicated coverage gate requires 100% lines, statements, functions and branches
for each benchmark module, including tooling excluded from production coverage.

The original Radeon 780M baseline with 500 elements and 298 OSM features was
approximately 5,700 draw calls per frame and 206.4 ms P95 frame time. Baseline
selection, placement preview and insertion P95 latencies were 234.5 ms, 203.2 ms
and 191.1 ms respectively. Hardware results should be compared using the same
scenario and canvas dimensions; software-rendered browser tests verify behavior
without asserting FPS.

## Radeon 780M acceptance, 2026-10-08

All 33 samples passed on AMD Radeon 780M / ANGLE D3D11, with `WEBGL_multi_draw`
and GPU timers available. The maximum percentiles across the measured gestures
and repetitions were:

| Elements | Canvas      | Average FPS range | Frame P95 max | Frame P99 max | Draw calls P95 range | CPU render P95 max | GPU P95 max |
| -------- | ----------- | ----------------- | ------------- | ------------- | -------------------- | ------------------ | ----------- |
| 100      | 1100 × 720  | 114.6–119.4       | 8.6 ms        | 16.8 ms       | 236–274              | 9.5 ms             | 6.4 ms      |
| 500      | 1100 × 720  | 84.2–119.6        | 16.8 ms       | 24.9 ms       | 304–406              | 17.7 ms            | 11.6 ms     |
| 500      | 1920 × 1080 | 73.5–115.0        | 16.9 ms       | 25.1 ms       | 341–382              | 17.1 ms            | 11.4 ms     |

At 500 elements / 1100 × 720, selection P95 decreased from 234.5 to 34.1 ms,
placement preview from 203.2 to 18.7 ms, and insertion from 191.1 to 40.7 ms.
Navigation used the prepared detail levels and pixel ratios 1.0 / 0.75; every
gesture restored the full detail level and the device's original pixel ratio 1.0.

The machine initially measured on battery at 7% charge. A system suspend
interrupted one zoom sample; that sample was discarded and repeated using the
source-hash-validated resume path while charging at 5%. Chrome Energy Saver was
disabled in the disposable profile for both sessions. No parallel tests ran during
the accepted measurements. Earlier measurements with default low-battery Energy
Saver exhibited a fixed approximately 30 FPS compositor limit despite CPU and GPU
render times below 10 ms.

The full report and interruption diagnostics are in
`output/playwright/city-design-performance/`. The accepted production source hash
is `f03196dbef073d16f490f838551fa5894c47dea6e3d0de63733a015022f36061`.
