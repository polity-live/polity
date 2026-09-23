import { execFileSync } from 'node:child_process';
import { element, documentSchema } from '../../../src/features/communication-studio/logic/document';
import { readFile, writeFile } from 'node:fs/promises';
import { render } from '../../studio/exporters';
import { unzipSync, strFromU8 } from 'fflate';
import assert from 'node:assert/strict';
const { document } = JSON.parse(await readFile('output/studio/visual-fixture.json', 'utf8'));
const imageId = crypto.randomUUID(),
  videoId = crypto.randomUUID();
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aPioAAAAASUVORK5CYII=',
  'base64'
);
const clip = 'output/studio/fixture-clip.mp4';
execFileSync(
  process.env.FFMPEG_PATH ?? 'ffmpeg',
  ['-y', '-f', 'lavfi', '-i', 'color=c=blue:s=160x90:d=1', '-pix_fmt', 'yuv420p', clip],
  { windowsHide: true, stdio: 'ignore' }
);
const media = {
  [imageId]: { bytes: png, mime: 'image/png', name: 'pixel.png' },
  [videoId]: { bytes: await readFile(clip), mime: 'video/mp4', name: 'clip.mp4' },
};
const line = element('chart', { x: 700, y: 60, width: 520, height: 420 });
assert(line.chart);
line.chart.kind = 'line';
const pie = element('chart', { x: 1300, y: 60, width: 520, height: 420 });
assert(pie.chart);
pie.chart.kind = 'pie';
pie.chart.colors = ['#cc3377', '#12362D', '#588DB2'];
document.pages.push({
  ...structuredClone(document.pages[0]),
  id: crypto.randomUUID(),
  title: 'All element types',
  order: 1,
  elements: [
    element('line', { x: 80, y: 60, width: 450, height: 30, strokeWidth: 8 }),
    element('ellipse', { x: 80, y: 180, width: 350, height: 240, opacity: 0.6, fill: '#cc3377' }),
    line,
    pie,
    element('image', { x: 80, y: 580, width: 400, height: 220, assetId: imageId }),
    element('video', { x: 700, y: 580, width: 500, height: 280, assetId: videoId }),
  ],
});
documentSchema.parse(document);
const report = [];
for (const format of ['png', 'pdf', 'pptx', 'xlsx', 'canva', 'zip', 'mp4']) {
  const result = await render(
    document,
    media,
    format,
    [],
    'output/studio/render',
    async () => {
      /* Fixture progress. */
    },
    async () => false
  );
  const file = format + '-' + result.name;
  await writeFile('output/studio/' + file, result.bytes);
  if (format === 'pptx') {
    const files = unzipSync(result.bytes),
      xml = Object.entries(files)
        .filter(([n]) => n.endsWith('.xml'))
        .map(([, b]) => strFromU8(b))
        .join('');
    assert(xml.includes('<a:tbl>'));
    assert(xml.includes('<c:chart'));
    assert(xml.includes('Gemeinsam'));
    assert(xml.includes('<c:pieChart>'));
    assert(xml.includes('<c:lineChart>'));
    assert(xml.includes('prst="ellipse"'));
    assert(xml.includes('<a:r>'));
    assert(Object.keys(files).some(n => n.endsWith('.mp4')));
  }
  report.push({
    format,
    status: 'passed',
    file,
    elementTypes: [
      ...new Set(document.pages.flatMap((p: any) => p.elements.map((e: any) => e.type))),
    ],
  });
}
await writeFile('output/studio/exports.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
