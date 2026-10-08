# Street Design camera benchmark

Run `pnpm run test:performance:city-design` on the target machine with hardware
acceleration enabled and no other tests or benchmarks running. The command builds
the actual scene renderer for production, serves it on `127.0.0.1:4321`, and opens
an isolated Chromium window. It closes its browser and preview server when done.
Before opening the browser, it waits for active Vitest or Playwright test runs to
finish so those runs cannot contaminate the hardware measurements.
It also checks between gestures and retries a sample if another test started.
Chromium background throttling is disabled to keep the hardware measurements
independent of which desktop window has focus; hardware acceleration is retained.

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

The original Radeon 780M baseline with 500 elements and 298 OSM features was
approximately 5,700 draw calls per frame and 206.4 ms P95 frame time. Baseline
selection, placement preview and insertion P95 latencies were 234.5 ms, 203.2 ms
and 191.1 ms respectively. Hardware results should be compared using the same
scenario and canvas dimensions; software-rendered browser tests verify behavior
without asserting FPS.
