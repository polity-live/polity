import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { PDFDocument } from 'pdf-lib';
import { render } from '../../studio/exporters';
import { defaultBrand } from '../../../src/features/communication-studio/logic/document';
import { createStudioTemplateDocumentV5 } from '../../../src/features/communication-studio/logic/templates-v5';

const document = createStudioTemplateDocumentV5('single', 'Studio V5 export', defaultBrand);
const frame = document.nodes.find(node => node.type === 'frame');
const sourceShape = document.nodes.find(node => node.type === 'shape');
const sourceText = document.nodes.find(node => node.type === 'richText');
assert(frame && sourceShape && sourceText);

const bottom = structuredClone(sourceShape);
const top = structuredClone(sourceShape);
const text = structuredClone(sourceText);
bottom.id = crypto.randomUUID();
top.id = crypto.randomUUID();
text.id = crypto.randomUUID();
bottom.name = 'Bottom shape';
top.name = 'Top shape';
text.name = 'Editable rich text';
bottom.transform = { ...bottom.transform, x: 100, y: 100, width: 450, height: 200, rotation: 0 };
top.transform = { ...top.transform, x: 300, y: 180, width: 450, height: 200, rotation: 0 };
text.transform = { ...text.transform, x: 240, y: 150, width: 450, height: 200, rotation: 0 };
bottom.style.fill = '#ff0000';
top.style.fill = '#0000ff';
bottom.zIndex = 0;
text.zIndex = 1;
top.zIndex = 2;
text.content = [
  { id: crypto.randomUUID(), type: 'p', children: [{ id: crypto.randomUUID(), text: 'CENTER' }] },
];
document.nodes = [frame, bottom, text, top];

const output = 'output/studio/canvas-export';
await mkdir(output, { recursive: true });
const results = [];
for (const format of ['png', 'pdf', 'pptx', 'canva', 'zip'] as const) {
  const exported = await render(
    document,
    {},
    format,
    [],
    output,
    async () => undefined,
    async () => false
  );
  assert(exported.bytes.length > 1000);
  await writeFile(`${output}/${format}-${exported.name}`, exported.bytes);
  if (format === 'png')
    assert.deepEqual([...exported.bytes.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  if (format === 'pdf') assert.equal((await PDFDocument.load(exported.bytes)).getPageCount(), 1);
  if (format === 'pptx') {
    const xml = strFromU8(unzipSync(exported.bytes)['ppt/slides/slide1.xml']);
    assert(xml.indexOf('FF0000') < xml.indexOf('CENTER'));
    assert(xml.indexOf('CENTER') < xml.indexOf('0000FF'));
  }
  if (format === 'canva') {
    const archive = unzipSync(exported.bytes);
    assert(archive['Canva-Import.md']);
    assert(archive['Studio-V5-export.pptx']);
  }
  if (format === 'zip') {
    const archive = unzipSync(exported.bytes);
    assert.equal(JSON.parse(strFromU8(archive['Polity-Projekt.json'])).schemaVersion, 5);
  }
  results.push({ format, bytes: exported.bytes.length, file: `${format}-${exported.name}` });
}
await writeFile('output/studio/canvas-exports.json', JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));
