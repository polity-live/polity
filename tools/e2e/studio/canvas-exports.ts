import { readFile, writeFile } from 'node:fs/promises';
import { render } from '../../studio/exporters';
import { unzipSync, strFromU8 } from 'fflate';
import assert from 'node:assert/strict';
import { documentSchema } from '../../../src/features/communication-studio/logic/document';

const fixture = JSON.parse(await readFile('output/studio/visual-fixture.json', 'utf8'));
const doc = documentSchema.parse(fixture.document);
doc.pages = doc.pages.slice(0, 1);
doc.pages[0].canvas = {
  version: 1,
  files: {},
  elements: [
    {
      id: 'canvas-box',
      type: 'rectangle',
      x: 80,
      y: 800,
      width: 240,
      height: 140,
      angle: 0,
      isDeleted: false,
      strokeColor: '#12362D',
      backgroundColor: '#B88A3B',
      fillStyle: 'solid',
      strokeWidth: 2,
      roughness: 0,
      opacity: 100,
      groupIds: [],
      frameId: null,
      roundness: null,
      boundElements: null,
      link: null,
      locked: false,
      seed: 10,
    },
    {
      id: 'canvas-text',
      type: 'text',
      text: 'Excalidraw export',
      originalText: 'Excalidraw export',
      x: 350,
      y: 800,
      width: 400,
      height: 50,
      angle: 0,
      isDeleted: false,
      strokeColor: '#12362D',
      backgroundColor: 'transparent',
      fontSize: 32,
      fontFamily: 2,
      lineHeight: 1.25,
      textAlign: 'left',
      verticalAlign: 'top',
      containerId: null,
      autoResize: true,
      strokeWidth: 1,
      roughness: 0,
      opacity: 100,
      groupIds: [],
      frameId: null,
      roundness: null,
      boundElements: null,
      link: null,
      locked: false,
      seed: 11,
    },
  ],
};
const results = [];
for (const format of ['png', 'pdf', 'pptx']) {
  const exported = await render(
    doc,
    {},
    format,
    [],
    'output/studio/canvas-export',
    async () => {
      /* No progress UI in the acceptance runner. */
    },
    async () => false
  );
  await writeFile(`output/studio/canvas-${exported.name}`, exported.bytes);
  assert(exported.bytes.length > 1000);
  if (format === 'pptx') {
    const files = unzipSync(exported.bytes);
    const xml = Object.entries(files)
      .filter(([name]) => name.endsWith('.xml'))
      .map(([, data]) => strFromU8(data))
      .join('');
    assert(xml.includes('<a:tbl>'));
    assert(xml.includes('Gemeinsam'));
    assert(xml.includes('Excalidraw export'));
  }
  results.push({ format, bytes: exported.bytes.length, file: exported.name });
}
await writeFile('output/studio/canvas-exports.json', JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));
