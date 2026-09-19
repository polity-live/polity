// Local acceptance check of the actual export pipeline; no production data or services.
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { PDFDocument } from 'pdf-lib';
import { createDocument } from '../../../src/features/communication-studio/logic/templates';
import { element } from '../../../src/features/communication-studio/logic/document';
import { render, ffmpeg, type MediaMap } from '../../studio/exporters';

const folder = path.resolve('output/studio-smoke');
await mkdir(folder, { recursive: true });
const doc = createDocument('video', 'Gemeinsam entscheiden');
doc.pages.forEach(p => {
  p.duration = 1;
});
const clip = path.join(folder, 'test-clip.mp4');
await ffmpeg([
  '-y',
  '-f',
  'lavfi',
  '-i',
  'testsrc2=size=320x240:rate=30',
  '-f',
  'lavfi',
  '-i',
  'sine=frequency=440:sample_rate=48000',
  '-t',
  '6',
  '-c:v',
  'libx264',
  '-pix_fmt',
  'yuv420p',
  '-c:a',
  'aac',
  clip,
]);
const id = crypto.randomUUID();
const media: MediaMap = {
  [id]: { mime: 'video/mp4', name: 'test-clip.mp4', bytes: new Uint8Array(await readFile(clip)) },
};
doc.pages[0].elements.push(
  element('video', {
    assetId: id,
    x: 100,
    y: 850,
    width: 880,
    height: 500,
    order: 4,
    trimStart: 1,
    muted: false,
    fit: 'cover',
  })
);
doc.pages[1].elements[1].text = '<script>literal text</script>';
for (const format of ['png', 'pdf', 'pptx', 'canva', 'xlsx', 'zip']) {
  const result = await render(
    doc,
    media,
    format,
    format === 'png' ? [doc.pages[0].id] : [],
    path.join(folder, format),
    async () => {
      /* Progress is exercised through worker acceptance. */
    },
    async () => false
  );
  await writeFile(path.join(folder, format + '-' + result.name), result.bytes);
  assert(result.bytes.length > 100);
  if (format === 'pdf') assert.equal((await PDFDocument.load(result.bytes)).getPageCount(), 5);
  if (format === 'pptx') {
    const zip = unzipSync(result.bytes);
    assert(strFromU8(zip['ppt/slides/slide1.xml']).includes('<a:t>Gemeinsam entscheiden</a:t>'));
    assert(Object.keys(zip).some(k => k.startsWith('ppt/media/') && k.endsWith('.mp4')));
  }
  if (format === 'zip') {
    const zip = unzipSync(result.bytes);
    assert.equal(Object.keys(zip).filter(k => k.startsWith('PNG/')).length, 5);
    assert(zip['Kampagnenplan.xlsx']);
    assert(zip['01.mp4']);
    await writeFile(path.join(folder, 'acceptance.mp4'), zip['01.mp4']);
    await ffmpeg(['-v', 'error', '-i', path.join(folder, 'acceptance.mp4'), '-f', 'null', '-']);
  }
  console.log(format + ': verified (' + result.bytes.length + ' bytes)');
}
