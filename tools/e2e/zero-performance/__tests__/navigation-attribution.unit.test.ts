import { expect, it } from 'vitest';
import {
  attributeNavigationProfile,
  attributeBackTrace,
  diagnosticSourceMapURL,
  originalScriptLocation,
} from '../navigation-attribution';

it('attributes replay functions with verified local maps and labels absent evidence', () => {
  const url = 'http://localhost:3000/assets/router.js';
  const profile = {
    nodes: [
      { id: 1, callFrame: { url, functionName: 'renderRoute', lineNumber: 0, columnNumber: 0 } },
    ],
    samples: [1, 1],
    timeDeltas: [1000, 2000],
  };
  const absent = attributeNavigationProfile(profile, new Map());
  expect(absent.functions[0]).toMatchObject({ sampledSelfMs: 3, sourceMapStatus: 'unavailable' });
  const mapped = attributeNavigationProfile(
    profile,
    new Map([
      [url, { version: 3, sources: ['router.ts'], names: ['originalRoute'], mappings: 'AAAAA' }],
    ])
  );
  expect(mapped.functions[0].source).toMatchObject({
    file: 'router.ts',
    line: 1,
    column: 1,
    name: 'originalRoute',
  });
  expect(mapped.scope).toBe('post-acceptance-fresh-context-history-diagnostic');
  expect(
    attributeNavigationProfile(profile, new Map([[url, {}]])).functions[0].sourceMapStatus
  ).toBe('unmapped');
});
it('accepts only bounded same-origin public source map URLs', () => {
  const asset = 'http://localhost:3000/assets/router.js';
  expect(diagnosticSourceMapURL('router.js.map', asset, 'http://localhost:3000')?.pathname).toBe(
    '/assets/router.js.map'
  );
  for (const ref of [
    'https://external.test/router.js.map',
    '../api/map',
    'data:application/json,{}',
    'router.js.map?token=secret',
  ])
    expect(diagnosticSourceMapURL(ref, asset, 'http://localhost:3000')).toBeUndefined();
});
it('cuts the back replay on one trace clock without attributing missing marks', () => {
  const cuts = attributeBackTrace([
    { name: 'history-diagnostic-back-1-start', ts: 1000 },
    { name: 'FunctionCall', ts: 900, dur: 500, stack: [{ functionName: 'renderRoute' }] },
    { name: 'history-diagnostic-back-1-end', ts: 1200 },
    { name: 'history-diagnostic-back-2-start', ts: 1500 },
  ]);
  expect(cuts[0]).toMatchObject({ status: 'observed', index: 1 });
  expect(cuts[0].events[0]).toMatchObject({ durationMs: 0.5, overlapMs: 0.2 });
  expect(cuts[1]).toMatchObject({ status: 'unknown', events: [] });
});
it('maps original frame script positions without replacing original timing evidence', () => {
  const sourceURL = 'http://localhost:3000/assets/router.js';
  const bundles = new Map([
    [
      sourceURL,
      {
        code: 'function b() {}',
        payload: { version: 3, sources: ['router.ts'], names: ['renderRoute'], mappings: 'AAAAA' },
      },
    ],
  ]);
  const script = { sourceURL, sourceCharPosition: 0, duration: 43.1 };
  expect(originalScriptLocation(script, bundles)).toMatchObject({
    status: 'mapped',
    source: { name: 'renderRoute', file: 'router.ts' },
  });
  expect(script.duration).toBe(43.1);
  expect(originalScriptLocation(script, new Map()).status).toBe('unavailable');
  expect(originalScriptLocation({ ...script, sourceCharPosition: -1 }, bundles).status).toBe(
    'invalid-offset'
  );
});
