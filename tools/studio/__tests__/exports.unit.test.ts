import { EventEmitter } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import { PDFDocument } from 'pdf-lib';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocument } from '../../../src/features/communication-studio/logic/templates';
import { element } from '../../../src/features/communication-studio/logic/document';
import { setTableBorders } from '../../../src/features/communication-studio/logic/table-operations';
import { defaultBrand } from '../../../src/features/communication-studio/logic/document';
import { createStudioTemplateDocumentV5 } from '../../../src/features/communication-studio/logic/templates-v5';
import { legacyDocumentToV3 } from '../../../src/features/communication-studio/logic/v3-adapter';
const io = vi.hoisted(() => ({
  launch: vi.fn(),
  spawn: vi.fn(),
  close: vi.fn(),
  evaluate: vi.fn(),
  route: vi.fn(),
  content: vi.fn(),
  paint: vi.fn(),
}));
vi.mock('playwright', () => ({ chromium: { launch: io.launch } }));
vi.mock('node:child_process', () => ({ spawn: io.spawn }));
vi.mock('node:fs/promises', async original => {
  const fs = await original<typeof import('node:fs/promises')>();
  return {
    ...fs,
    readFile: async (file: string, ...rest: any[]) => {
      if (String(file).endsWith('.woff2')) {
        if (String(file).includes('700')) throw new Error('Weight not installed');
        return Buffer.from('font');
      }
      if (String(file).endsWith('video.mp4')) return Buffer.from('encoded-video');
      return (fs.readFile as any)(file, ...rest);
    },
  };
});
import { ffmpeg, pageFile, render, selectStudioExportDocument } from '../exporters';
import {
  createFrameNode,
  createStudioDocumentV5,
  drawingNodeSchema,
} from '../../../src/features/communication-studio/logic/document-v3';
const imageId = '11111111-1111-4111-8111-111111111111',
  videoId = '22222222-2222-4222-8222-222222222222';
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aPioAAAAASUVORK5CYII=',
  'base64'
);
const pngUrl = `data:image/png;base64,${png.toString('base64')}`;
let temp: string, audio: boolean, encoderCode: number, spawnError: Error | undefined;
class Video {
  videoWidth = 100;
  videoHeight = 200;
}
beforeEach(async () => {
  vi.clearAllMocks();
  audio = true;
  encoderCode = 0;
  spawnError = undefined;
  temp = await mkdtemp(path.join(os.tmpdir(), 'polity-export-unit-'));
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({ drawImage: vi.fn() }),
    toDataURL: () => pngUrl,
  };
  vi.stubGlobal('document', {
    fonts: { load: vi.fn().mockResolvedValue(undefined) },
    createElement: () => canvas,
  });
  vi.stubGlobal('HTMLVideoElement', Video);
  vi.stubGlobal('window', {
    paintStudioPage: io.paint,
    PolityStudioV5Renderer: { renderFrame: io.paint },
    __studioMedia: { [imageId]: { naturalWidth: 200, naturalHeight: 100 }, [videoId]: new Video() },
  });
  io.paint.mockResolvedValue(pngUrl);
  io.evaluate.mockImplementation(async (fn: unknown, arg: unknown) =>
    typeof fn === 'function' ? fn(arg) : undefined
  );
  io.route.mockImplementation(async (_pattern, body) => body({ abort: vi.fn() }));
  io.launch.mockResolvedValue({
    newPage: async () => ({
      route: io.route,
      setContent: io.content,
      evaluate: io.evaluate,
      addScriptTag: vi.fn(),
    }),
    close: io.close,
  });
  io.close.mockResolvedValue(undefined);
  io.spawn.mockImplementation((_cmd, args: string[]) => {
    const child = Object.assign(new EventEmitter(), { stderr: new EventEmitter() });
    queueMicrotask(() => {
      if (spawnError) {
        child.emit('error', spawnError);
        return;
      }
      child.stderr.emit(
        'data',
        Buffer.from(audio && args.length === 2 ? 'Stream #0: Audio: aac' : 'encoder detail')
      );
      child.emit('close', args.length === 2 ? 1 : encoderCode);
    });
    return child;
  });
});
afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  const absolute = path.resolve(temp),
    root = path.resolve(os.tmpdir()) + path.sep;
  if (!absolute.startsWith(root + 'polity-export-unit-')) throw new Error('Unsafe test cleanup');
  await rm(absolute, { recursive: true, force: true });
});
const exportDoc = (
  doc: ReturnType<typeof createDocument>,
  format: string,
  media = {},
  selected: string[] = [],
  cancel = vi.fn().mockResolvedValue(false)
) => render(doc, media, format, selected, temp, vi.fn().mockResolvedValue(undefined), cancel);

function installMediaDecoderBoundary(
  options: { duration?: number; failDecode?: boolean; failCanvas?: number } = {}
) {
  const seek = vi.fn();
  let canvases = 0;
  class ImageSource {
    naturalWidth = 100;
    naturalHeight = 200;
    onerror?: () => void;
    onload?: () => void;
    set src(_url: string) {
      queueMicrotask(() => (options.failDecode ? this.onerror?.() : this.onload?.()));
    }
  }
  class VideoSource extends ImageSource {
    videoWidth = 100;
    videoHeight = 200;
    duration = options.duration ?? 10;
    onloadeddata?: () => void;
    onseeked?: () => void;
    set src(_url: string) {
      queueMicrotask(() => (options.failDecode ? this.onerror?.() : this.onloadeddata?.()));
    }
    set currentTime(time: number) {
      seek(time);
      queueMicrotask(() => this.onseeked?.());
    }
  }
  vi.stubGlobal('Image', ImageSource);
  vi.stubGlobal('HTMLVideoElement', VideoSource);
  vi.stubGlobal('document', {
    fonts: { load: vi.fn().mockResolvedValue(undefined) },
    createElement: (tag: string) =>
      tag === 'video'
        ? new VideoSource()
        : {
            width: 0,
            height: 0,
            getContext: () => (++canvases === options.failCanvas ? null : { drawImage: vi.fn() }),
            toDataURL: () => pngUrl,
          },
  });
  vi.stubGlobal('window', { PolityStudioV5Renderer: { renderFrame: io.paint } });
  return { seek };
}
describe('Studio export artifacts', () => {
  it.each(['image', 'video'] as const)(
    'loads an uncached %s before writing a raster poster into the Canva deck',
    async type => {
      const decoder = installMediaDecoderBoundary();
      const id = type === 'video' ? videoId : imageId;
      const doc = createDocument('single', 'Loaded poster');
      doc.pages[0].elements = [element(type, { assetId: id, trimStart: 1 })];
      const result = await exportDoc(doc, 'canva', {
        [id]: { mime: type === 'video' ? 'video/mp4' : 'image/png', bytes: png, name: 'source' },
      });
      const deck = unzipSync(unzipSync(result.bytes)['Loaded-poster.pptx']);
      expect(
        Object.keys(deck).some(file => file.startsWith('ppt/media/') && file.endsWith('.png'))
      ).toBe(true);
      if (type === 'video') expect(decoder.seek).toHaveBeenCalledWith(2);
      else expect(decoder.seek).not.toHaveBeenCalled();
    }
  );

  it('does not seek past the beginning of a video whose decoded duration is zero', async () => {
    const decoder = installMediaDecoderBoundary({ duration: 0 });
    const doc = createDocument('single', 'Zero duration');
    doc.pages[0].elements = [element('video', { assetId: videoId })];
    await exportDoc(doc, 'canva', { [videoId]: { mime: 'video/mp4', bytes: png, name: 'source' } });
    expect(decoder.seek).not.toHaveBeenCalled();
  });

  it.each(['decode', 'raster-canvas', 'poster-canvas'] as const)(
    'rejects %s failures and closes the isolated export browser',
    async failure => {
      installMediaDecoderBoundary({
        failDecode: failure === 'decode',
        failCanvas: failure === 'raster-canvas' ? 1 : failure === 'poster-canvas' ? 2 : undefined,
      });
      const doc = createDocument('single', 'Failed poster');
      doc.pages[0].elements = [element('image', { assetId: imageId })];
      await expect(
        exportDoc(doc, 'canva', { [imageId]: { mime: 'image/png', bytes: png, name: 'source' } })
      ).rejects.toThrow(failure === 'decode' ? 'Media could not be decoded' : 'Canvas unavailable');
      expect(io.close).toHaveBeenCalledOnce();
    }
  );

  it('keeps a missing media source out of the editable slide without inventing an image', async () => {
    const doc = createDocument('single', 'Unavailable media');
    doc.pages[0].elements = [element('image', { assetId: imageId })];
    const deck = unzipSync((await exportDoc(doc, 'pptx')).bytes);
    expect(strFromU8(deck['ppt/slides/slide1.xml'])).not.toContain('<p:pic>');
  });

  it('exports marks shared by every text run and preserves transparent shape outlines', async () => {
    const document = createStudioTemplateDocumentV5('single', 'Uniform marks', defaultBrand);
    const text = document.nodes.find(node => node.type === 'richText')!;
    const shape = document.nodes.find(node => node.type === 'shape')!;
    shape.style.strokeWidth = 0;
    text.content = [
      {
        id: crypto.randomUUID(),
        type: 'p',
        children: [
          {
            id: crypto.randomUUID(),
            text: 'Uniform',
            bold: true,
            italic: true,
            underline: true,
            strikethrough: true,
          },
        ],
      },
    ];
    const files = unzipSync(
      (
        await render(
          document,
          {},
          'pptx',
          [],
          temp,
          async () => undefined,
          async () => false
        )
      ).bytes
    );
    const xml = strFromU8(files['ppt/slides/slide1.xml']);
    expect(xml).toContain('sngStrike');
    expect(xml).toContain('u="sng"');
    expect(xml).toContain('<a:alpha val="0"/>');
  });

  it('uses the default pie palette when the current chart defines no colors', async () => {
    const doc = createDocument('single', 'Default palette');
    const chart = element('chart');
    chart.chart!.kind = 'pie';
    chart.chart!.series = [chart.chart!.series[0]];
    delete chart.chart!.colors;
    doc.pages[0].elements = [chart];
    const files = unzipSync((await exportDoc(doc, 'pptx')).bytes);
    const xml = strFromU8(
      Object.entries(files).find(([file]) => /^ppt\/charts\/chart\d+\.xml$/.test(file))![1]
    );
    expect(xml).toContain('B88A3B');
  });

  it('rejects a native two-frame video longer than the MP4 limit', async () => {
    const document = createStudioTemplateDocumentV5('presentation', 'Long sequence', defaultBrand);
    document.deliverables[0].kind = 'video';
    for (const node of document.nodes) if (node.type === 'frame') node.duration = 31;
    await expect(
      render(
        document,
        {},
        'mp4',
        [],
        temp,
        async () => undefined,
        async () => false
      )
    ).rejects.toThrow('exceeds 60 seconds');
  });

  it('includes chart source files and original video bytes only when referenced by the selected project', async () => {
    const doc = createDocument('single', 'Referenced originals');
    const chart = element('chart');
    doc.pages[0].elements = [chart, element('video', { assetId: videoId })];
    const document = legacyDocumentToV3(doc);
    document.nodes.find(node => node.type === 'chart')!.sourceAssetId = imageId;
    const files = unzipSync(
      (
        await render(
          document,
          {
            [imageId]: { mime: 'image/png', bytes: png, name: 'source' },
            [videoId]: { mime: 'video/mp4', bytes: png, name: 'video' },
          },
          'zip',
          [],
          temp,
          async () => undefined,
          async () => false
        )
      ).bytes
    );
    expect(files[`Medien/${imageId}.png`]).toEqual(new Uint8Array(png));
    expect(files[`Medien/${videoId}.mp4`]).toEqual(new Uint8Array(png));
  });
  it('rejects missing, nested and master frame selections and an empty exportable document', () => {
    const document = createStudioDocumentV5('Empty');
    expect(() => selectStudioExportDocument(document, [])).toThrow('Select at least one frame');
    const root = createFrameNode();
    const nested = createFrameNode('square', { parentFrameId: root.id });
    const master = createFrameNode();
    document.nodes = [root, nested, master];
    document.masterLayout.frameId = master.id;
    for (const invalid of [crypto.randomUUID(), nested.id, master.id])
      expect(() => selectStudioExportDocument(document, [invalid])).toThrow('cannot be exported');
    expect(() => selectStudioExportDocument(document, [root.id])).not.toThrow();
  });

  it('retains selected descendants, master content and only component instances used by the selection', () => {
    const document = createStudioTemplateDocumentV5('single', 'Selection', defaultBrand);
    const root = document.nodes.find(node => node.type === 'frame')!;
    const master = createFrameNode();
    document.nodes.push(master);
    document.masterLayout.frameId = master.id;
    const child = createFrameNode('square', { parentFrameId: root.id });
    document.nodes.push(child);
    document.componentInstances = [
      {
        id: crypto.randomUUID(),
        setId: crypto.randomUUID(),
        revisionId: crypto.randomUUID(),
        sourceToInstance: { [crypto.randomUUID()]: child.id },
        localOverrides: {},
        localDeletions: [],
        detachedNodes: [],
      },
      {
        id: crypto.randomUUID(),
        setId: crypto.randomUUID(),
        revisionId: crypto.randomUUID(),
        sourceToInstance: { [crypto.randomUUID()]: crypto.randomUUID() },
        localOverrides: {},
        localDeletions: [],
        detachedNodes: [],
      },
    ];
    const result = selectStudioExportDocument(document, [root.id]);
    expect(result.nodes.map(node => node.id)).toEqual(
      expect.arrayContaining([root.id, child.id, master.id])
    );
    expect(result.componentInstances.map(item => item.id)).toEqual([
      document.componentInstances[0].id,
    ]);
    expect(document.componentInstances).toHaveLength(2);
  });

  it('exports native freehand strokes and all editable shape variants into a real PPTX archive', async () => {
    const document = createStudioTemplateDocumentV5('single', 'Drawings', defaultBrand);
    const root = document.nodes.find(node => node.type === 'frame')!;
    const shape = document.nodes.find(node => node.type === 'shape')!;
    document.nodes = [
      root,
      ...(['ellipse', 'diamond', 'rounded-rectangle', 'line', 'arrow'] as const).map(
        (kind, index) => ({
          ...structuredClone(shape),
          id: crypto.randomUUID(),
          shape: kind,
          style: { ...shape.style, strokeWidth: 3 },
          zIndex: index,
        })
      ),
    ];
    for (const [index, stroke] of [null, '#ff0000'].entries())
      document.nodes.push(
        drawingNodeSchema.parse({
          ...structuredClone(shape),
          id: crypto.randomUUID(),
          type: 'drawing',
          zIndex: 10 + index,
          style: { ...shape.style, stroke },
          points: [
            [0, 0],
            [30, 50],
          ],
        })
      );
    const result = await render(
      document,
      {},
      'pptx',
      [],
      temp,
      async () => undefined,
      async () => false
    );
    const files = unzipSync(result.bytes);
    const xml = strFromU8(files['ppt/slides/slide1.xml']);
    for (const preset of ['ellipse', 'diamond', 'roundRect', 'line'])
      expect(xml).toContain(`prst="${preset}"`);
    expect(xml).toContain('type="triangle"');
    const drawings = Object.entries(files).filter(
      ([file]) => file.startsWith('ppt/media/') && file.endsWith('.svg')
    );
    expect(drawings).toHaveLength(2);
    expect(strFromU8(drawings[0][1])).toContain('polyline');
    expect(drawings.map(([, bytes]) => strFromU8(bytes)).join('\n')).toContain('#ff0000');
  });

  it.each(['bar', 'line', 'pie'] as const)(
    'exports native %s charts with labels, values, legends and colors',
    async kind => {
      const doc = createDocument('single', `Chart ${kind}`);
      const chart = element('chart');
      chart.chart = {
        kind,
        labels: ['First', 'Second'],
        legend: false,
        series: [{ id: crypto.randomUUID(), name: 'Series', color: '#ff0000', values: [1, 2] }],
        ...(kind === 'pie' ? { colors: ['#00ff00', '#0000ff'] } : {}),
      };
      doc.pages[0].elements = [chart];
      const files = unzipSync((await exportDoc(doc, 'pptx')).bytes);
      const chartEntry = Object.entries(files).find(([file]) =>
        /^ppt\/charts\/chart\d+\.xml$/.test(file)
      );
      expect(chartEntry).toBeDefined();
      const xml = strFromU8(chartEntry![1]);
      expect(xml).toContain('First');
      expect(xml).toContain('Second');
      expect(xml).toContain('Series');
      expect(xml).toContain(kind === 'pie' ? '00FF00' : 'FF0000');
    }
  );

  it('exports rich-text marks, hyperlinks, numbered and bulleted paragraphs into editable slide text', async () => {
    const document = createStudioTemplateDocumentV5('single', 'Marks', defaultBrand);
    const text = document.nodes.find(node => node.type === 'richText')!;
    text.typography.horizontalAlign = 'center';
    text.content = [
      {
        id: crypto.randomUUID(),
        type: 'p',
        list: 'bullet',
        align: 'right',
        children: [
          {
            id: crypto.randomUUID(),
            type: 'a',
            url: 'https://example.com',
            children: [
              {
                id: crypto.randomUUID(),
                text: 'Styled',
                bold: true,
                italic: true,
                underline: true,
                strikethrough: true,
                color: '#ff0000',
                fontFamily: 'Inter',
                fontSize: 30,
              },
            ],
          },
        ],
      },
      {
        id: crypto.randomUUID(),
        type: 'p',
        list: 'number',
        children: [{ id: crypto.randomUUID(), text: 'Numbered' }],
      },
      {
        id: crypto.randomUUID(),
        type: 'p',
        children: [
          { id: crypto.randomUUID(), text: 'Plain', underline: false, strikethrough: false },
        ],
      },
    ];
    const files = unzipSync(
      (
        await render(
          document,
          {},
          'pptx',
          [],
          temp,
          async () => undefined,
          async () => false
        )
      ).bytes
    );
    const xml = strFromU8(files['ppt/slides/slide1.xml']);
    expect(xml).toContain('Styled');
    expect(xml).toContain('Numbered');
    expect(xml).toContain('Plain');
    expect(xml).toContain('sngStrike');
    expect(xml).toContain('FF0000');
    expect(xml).toContain('buAutoNum');
    expect(strFromU8(files['ppt/slides/_rels/slide1.xml.rels'])).toContain('https://example.com');
  });

  it.each(['image/jpeg', 'image/webp'])(
    'keeps the original %s file beside a campaign backup',
    async mime => {
      const doc = createDocument('single', 'Media');
      doc.pages[0].elements.push(element('image', { assetId: imageId }));
      const files = unzipSync(
        (await exportDoc(doc, 'zip', { [imageId]: { mime, bytes: png, name: 'original' } })).bytes
      );
      expect(files[`Medien/${imageId}.${mime === 'image/jpeg' ? 'jpg' : 'webp'}`]).toEqual(
        new Uint8Array(png)
      );
    }
  );

  it('rejects mixed-size MP4 sequences and includes a useful omission note in ZIP exports', async () => {
    const doc = createDocument('video', 'Mixed video');
    doc.pages = doc.pages.slice(0, 2);
    doc.pages[0].duration = 1;
    doc.pages[1].duration = 1;
    doc.pages[1].format = 'square';
    doc.posts[0].pageIds = doc.pages.map(page => page.id);
    await expect(exportDoc(doc, 'mp4')).rejects.toThrow('same format');
    const files = unzipSync((await exportDoc(doc, 'zip')).bytes);
    expect(strFromU8(files['Video-Hinweis.md'])).toContain('unterschiedlichen Formaten');
    expect(Object.keys(files).some(file => file.endsWith('.mp4'))).toBe(false);
  });
  it('exports a presentation deliverable as three editable widescreen slides in order', async () => {
    const document = createStudioTemplateDocumentV5('presentation', 'Treffen', defaultBrand);
    const frameIds = document.deliverables[0].frameIds;
    const result = await render(
      document,
      {},
      'pptx',
      frameIds,
      temp,
      vi.fn().mockResolvedValue(undefined),
      vi.fn().mockResolvedValue(false)
    );
    const deck = unzipSync(result.bytes);
    expect(document.deliverables[0].kind).toBe('presentation');
    expect(deck['ppt/slides/slide1.xml']).toBeDefined();
    expect(deck['ppt/slides/slide2.xml']).toBeDefined();
    expect(deck['ppt/slides/slide3.xml']).toBeDefined();
    expect(deck['ppt/slides/slide4.xml']).toBeUndefined();
    expect(strFromU8(deck['ppt/slides/slide1.xml'])).toContain('Treffen');
    expect(strFromU8(deck['ppt/slides/slide1.xml'])).toContain('<p:sp>');
  });
  it('keeps V5 shape-text-shape order and editable text in PowerPoint', async () => {
    const document = createStudioTemplateDocumentV5('single', 'V5 order', defaultBrand);
    const frame = document.nodes.find(node => node.type === 'frame')!;
    const title = document.nodes.find(node => node.type === 'richText')!;
    const source = document.nodes.find(node => node.type === 'shape')!;
    const bottom = structuredClone(source);
    const top = structuredClone(source);
    bottom.id = crypto.randomUUID();
    top.id = crypto.randomUUID();
    bottom.style.fill = '#ff0000';
    top.style.fill = '#0000ff';
    bottom.zIndex = 0;
    title.zIndex = 1;
    top.zIndex = 2;
    title.content = [
      {
        id: crypto.randomUUID(),
        type: 'p',
        children: [{ id: crypto.randomUUID(), text: 'CENTER' }],
      },
    ];
    document.nodes = [frame, bottom, title, top];
    const result = await render(
      document,
      {},
      'pptx',
      [],
      temp,
      vi.fn().mockResolvedValue(undefined),
      vi.fn().mockResolvedValue(false)
    );
    const xml = strFromU8(unzipSync(result.bytes)['ppt/slides/slide1.xml']);
    expect(xml.indexOf('FF0000')).toBeLessThan(xml.indexOf('CENTER'));
    expect(xml.indexOf('CENTER')).toBeLessThan(xml.indexOf('0000FF'));
    expect(xml).toContain('CENTER');
  });
  it('keeps disabled table edges editable and hidden in PowerPoint', async () => {
    const doc = createDocument('single', 'Table borders');
    const table = element('table');
    const selection = { anchorRow: 0, focusRow: 0, anchorColumn: 0, focusColumn: 0 };
    table.table = setTableBorders(table.table!, selection, 'none');
    doc.pages[0].elements.push(table);
    const result = await exportDoc(doc, 'pptx');
    const xml = strFromU8(unzipSync(result.bytes)['ppt/slides/slide1.xml']);
    const firstCell = xml.match(/<a:tcPr\b[^>]*>[\s\S]*?<\/a:tcPr>/)?.[0];
    expect(firstCell).toMatch(/<a:lnL\b[^>]*><a:noFill\/>/);
    expect(firstCell).toMatch(/<a:lnR\b[^>]*><a:noFill\/>/);
    expect(firstCell).toMatch(/<a:lnT\b[^>]*><a:noFill\/>/);
    expect(firstCell).toMatch(/<a:lnB\b[^>]*><a:noFill\/>/);
    expect(xml).toContain('<a:srgbClr val="888888"/>');
  });
  it('fails an unavailable raster canvas without returning a misleading completed Canva export', async () => {
    const d = createDocument('single', 'Test');
    d.pages[0].elements.push(element('image', { assetId: imageId }));
    vi.stubGlobal('document', {
      fonts: { load: vi.fn().mockResolvedValue(undefined) },
      createElement: () => ({ getContext: () => null }),
    });
    await expect(
      exportDoc(d, 'canva', { [imageId]: { bytes: png, mime: 'image/png' } })
    ).rejects.toThrow('Canvas unavailable');
    expect(io.close).toHaveBeenCalled();
  });
  it('renders selected PNG pages at the original campaign index and returns a single image directly', async () => {
    const doc = createDocument('carousel', 'Presentation');
    const result = await exportDoc(doc, 'png', {}, [doc.pages[1].id]);
    expect(result.mime).toBe('image/png');
    expect(result.name).toBe(pageFile(doc.pages[1], 1));
    expect(result.bytes).toEqual(new Uint8Array(png));
    expect(io.paint).toHaveBeenCalledTimes(1);
    expect(io.paint.mock.calls[0][1]).toBe(doc.pages[1].id);
    expect(io.close).toHaveBeenCalledTimes(1);
    expect(pageFile({ ...doc.pages[0], name: '' }, 0)).toBe('001-polity.png');
  });
  it('exports multi-page PNG archives and PDF pages with their exact requested dimensions', async () => {
    const doc = createDocument('carousel', 'Deck');
    doc.pages[1].format = 'square';
    const selected = [doc.pages[0].id, doc.pages[1].id];
    const archive = await exportDoc(doc, 'png', {}, selected);
    expect(archive.mime).toBe('application/zip');
    expect(archive.name).toBe('Deck.zip');
    const files = unzipSync(archive.bytes);
    expect(Object.keys(files)).toHaveLength(selected.length);
    expect(Object.keys(files)[0]).toMatch(/^PNG\/001-/);
    expect(Object.keys(files)[1]).toMatch(/^PNG\/002-/);
    expect(io.paint.mock.calls.map(call => call[1])).toEqual(selected);
    const result = await exportDoc(doc, 'pdf');
    expect(result.name).toBe('Deck.pdf');
    expect(result.mime).toBe('application/pdf');
    const pdf = await PDFDocument.load(result.bytes);
    expect(pdf.getPageCount()).toBe(doc.pages.length);
    expect(pdf.getPage(0).getSize()).toEqual({ width: 810, height: 1012.5 });
    expect(pdf.getPage(1).getSize()).toEqual({ width: 810, height: 810 });
    const xlsx = await exportDoc(doc, 'xlsx', {}, selected);
    expect(xlsx.name).toBe('Deck.zip');
    expect(Object.keys(unzipSync(xlsx.bytes))).toEqual(['Deck.xlsx']);
  });
  it('keeps PowerPoint text and shapes editable and embeds media in one presentation', async () => {
    const doc = createDocument('single', 'Editable');
    doc.pages[0].elements.push(
      element('ellipse', { rotation: 25, opacity: 0.5 }),
      element('image', { assetId: imageId, fit: 'contain' }),
      element('video', { assetId: videoId })
    );
    const media = {
      [imageId]: { mime: 'image/png', bytes: png, name: 'photo.png' },
      [videoId]: { mime: 'video/mp4', bytes: new Uint8Array([1, 2]), name: 'video.mp4' },
    };
    const result = await exportDoc(doc, 'pptx', media);
    const ppt = unzipSync(result.bytes);
    const xml = strFromU8(ppt['ppt/slides/slide1.xml']);
    expect(xml).toContain('Editable');
    expect(xml).toContain('ellipse');
    expect(Object.keys(ppt).filter(name => name.startsWith('ppt/media/'))).toContainEqual(
      expect.stringMatching(/mp4$/)
    );
    expect(result.mime).toContain('presentationml');
    doc.pages.push({
      ...structuredClone(doc.pages[0]),
      id: crypto.randomUUID(),
      format: 'square',
      elements: doc.pages[0].elements.map(item => ({
        ...structuredClone(item),
        id: crypto.randomUUID(),
      })),
    });
    const multiple = await exportDoc(doc, 'pptx', media);
    expect(multiple.name).toBe('Editable.pptx');
    expect(multiple.mime).toContain('presentationml');
    const slides = unzipSync(multiple.bytes);
    expect(slides['ppt/slides/slide1.xml']).toBeDefined();
    expect(slides['ppt/slides/slide2.xml']).toBeDefined();
    expect(slides['ppt/slides/slide3.xml']).toBeUndefined();
  });
  it('returns a multi-frame PPTX directly with one slide per selected frame', async () => {
    const doc = createDocument('carousel', 'Slides');
    const selected = doc.pages.slice(0, 2).map(page => page.id);
    const result = await exportDoc(doc, 'pptx', {}, selected);
    expect(result.name).toBe('Slides.pptx');
    expect(result.mime).toContain('presentationml');
    const slides = unzipSync(result.bytes);
    expect(slides['ppt/slides/slide1.xml']).toBeDefined();
    expect(slides['ppt/slides/slide2.xml']).toBeDefined();
    expect(slides['ppt/slides/slide3.xml']).toBeUndefined();
  });
  it('keeps frame order and centers a square frame on the first frame’s portrait slide', async () => {
    const doc = createDocument('carousel', 'Mixed sizes');
    doc.pages[0].elements = [element('text', { text: 'FIRST_FRAME' })];
    doc.pages[1].format = 'square';
    doc.pages[1].elements = [
      element('rect', {
        x: 0,
        y: 0,
        width: 1080,
        height: 1080,
        fill: '#00ff00',
        strokeWidth: 0,
      }),
      element('text', { text: 'SECOND_FRAME' }),
    ];
    const result = await exportDoc(doc, 'pptx', {}, [doc.pages[1].id, doc.pages[0].id]);
    const deck = unzipSync(result.bytes);
    expect(strFromU8(deck['ppt/presentation.xml'])).toContain('cx="6858000" cy="8572500"');
    expect(strFromU8(deck['ppt/slides/slide1.xml'])).toContain('FIRST_FRAME');
    const secondSlide = strFromU8(deck['ppt/slides/slide2.xml']);
    expect(secondSlide).toContain('SECOND_FRAME');
    const greenShape = (secondSlide.match(/<p:sp>[\s\S]*?<\/p:sp>/g) ?? []).find(shape =>
      shape.includes('00FF00')
    );
    expect(greenShape).toContain('<a:off x="0" y="857250"/>');
    expect(greenShape).toContain('<a:ext cx="6858000" cy="6858000"/>');
  });
  it('keeps all selected frames in the single presentation inside the Canva package', async () => {
    const doc = createDocument('carousel', 'Canva slides');
    doc.pages[1].format = 'square';
    const result = await exportDoc(
      doc,
      'canva',
      {},
      doc.pages.slice(0, 2).map(page => page.id)
    );
    expect(result.name).toBe('Canva-slides.zip');
    const files = unzipSync(result.bytes);
    expect(Object.keys(files).filter(file => file.endsWith('.pptx'))).toEqual([
      'Canva-slides.pptx',
    ]);
    expect(files['Canva-Import.md']).toBeDefined();
    const deck = unzipSync(files['Canva-slides.pptx']);
    expect(deck['ppt/slides/slide1.xml']).toBeDefined();
    expect(deck['ppt/slides/slide2.xml']).toBeDefined();
    expect(deck['ppt/slides/slide3.xml']).toBeUndefined();
  });
  it('packages Canva import instructions and raster video posters in editable PowerPoint slides', async () => {
    const doc = createDocument('single', 'Canva');
    doc.pages[0].elements.push(
      element('image', { assetId: imageId, fit: 'cover' }),
      element('video', { assetId: videoId })
    );
    const result = await exportDoc(doc, 'canva', {
      [imageId]: { mime: 'image/png', bytes: png, name: 'image.png' },
      [videoId]: { mime: 'video/mp4', bytes: new Uint8Array([1]), name: 'video.mp4' },
    });
    const files = unzipSync(result.bytes);
    expect(strFromU8(files['Canva-Import.md'])).toContain('PowerPoint');
    const ppt = unzipSync(files['Canva.pptx']);
    expect(Object.keys(ppt).some(name => name.endsWith('.mp4'))).toBe(false);
    expect(
      Object.keys(ppt).some(name => name.startsWith('ppt/media/') && name.endsWith('.png'))
    ).toBe(true);
  });
  it('exports cropped images as picture objects and cropped video posters with the original video beside the PPTX', async () => {
    const doc = createDocument('carousel', 'Cropped');
    const crop = { x: 25, y: 0, width: 50, height: 100, naturalWidth: 100, naturalHeight: 100 };
    doc.pages[0].elements.push(
      element('image', { assetId: imageId, fit: 'cover', crop }),
      element('video', { assetId: videoId, fit: 'cover', crop })
    );
    const sourceVideo = new Uint8Array([1, 2, 3]);
    const result = await exportDoc(doc, 'pptx', {
      [imageId]: { mime: 'image/png', bytes: png, name: 'photo.png' },
      [videoId]: { mime: 'video/mp4', bytes: sourceVideo, name: 'clip.mp4' },
    });
    expect(result.mime).toBe('application/zip');
    const files = unzipSync(result.bytes);
    expect(Object.keys(files).filter(file => file.endsWith('.pptx'))).toEqual(['Cropped.pptx']);
    expect(files[`Medien/${videoId}.mp4`]).toEqual(sourceVideo);
    const ppt = unzipSync(files['Cropped.pptx']);
    const slide = strFromU8(ppt['ppt/slides/slide1.xml']);
    expect(ppt['ppt/slides/slide2.xml']).toBeDefined();
    expect(slide.match(/<p:pic>/g) ?? []).toHaveLength(2);
    expect(Object.keys(ppt).some(name => name.endsWith('.mp4'))).toBe(false);
    expect(
      Object.keys(ppt).filter(name => name.startsWith('ppt/media/') && name.endsWith('.png'))
    ).toHaveLength(2);
  });
  it('creates a complete campaign archive with media, channel captions, calendar and presentation', async () => {
    const doc = createDocument('single', 'Campaign');
    doc.pages[0].elements.push(element('image', { assetId: imageId }));
    const media = {
      [imageId]: { mime: 'image/png', bytes: png, name: 'source' },
      [videoId]: { mime: 'video/mp4', bytes: png, name: 'unused' },
    };
    const result = await exportDoc(doc, 'zip', media);
    const files = unzipSync(result.bytes);
    expect(Object.keys(files)).toEqual(
      expect.arrayContaining([
        `Medien/${imageId}.png`,
        'Kampagnenplan.xlsx',
        'Kanaltexte.md',
        'Polity-Projekt.json',
        'Campaign.pdf',
        'Campaign.pptx',
        'Canva/Campaign.pptx',
        'Canva/Canva-Import.md',
      ])
    );
    expect(files[`Medien/${videoId}.mp4`]).toBeUndefined();
    expect(strFromU8(files['Kanaltexte.md'])).toContain('instagram');
    expect(JSON.parse(strFromU8(files['Polity-Projekt.json']))).toMatchObject({ schemaVersion: 5 });
    expect(Object.keys(unzipSync(files['Kampagnenplan.xlsx']))).toContain('xl/workbook.xml');
    const excel = await exportDoc(doc, 'xlsx');
    expect(excel.name).toBe('Campaign.xlsx');
    expect(excel.mime).toContain('spreadsheet');
  });
  it('limits every ZIP artifact and its project backup to marked frames', async () => {
    const doc = createDocument('carousel', 'Selected');
    doc.pages = doc.pages.slice(0, 2);
    doc.pages[0].elements.push(element('image', { assetId: imageId }));
    doc.pages[1].elements.push(element('image', { assetId: videoId }));
    doc.posts = [
      { ...doc.posts[0], pageIds: doc.pages.map(page => page.id) },
      {
        ...structuredClone(doc.posts[0]),
        id: crypto.randomUUID(),
        code: 'UNSELECTED',
        pageIds: [doc.pages[1].id],
      },
    ];
    const result = await exportDoc(
      doc,
      'zip',
      {
        [imageId]: { mime: 'image/png', bytes: png, name: 'selected.png' },
        [videoId]: { mime: 'image/png', bytes: png, name: 'other.png' },
      },
      [doc.pages[0].id]
    );
    const files = unzipSync(result.bytes);
    expect(Object.keys(files).filter(name => name.startsWith('PNG/'))).toEqual([
      `PNG/${pageFile(doc.pages[0], 0)}`,
    ]);
    expect(files[`Medien/${imageId}.png`]).toBeDefined();
    expect(files[`Medien/${videoId}.png`]).toBeUndefined();
    const project = JSON.parse(strFromU8(files['Polity-Projekt.json']));
    expect(project.nodes.some((node: { id: string }) => node.id === doc.pages[1].id)).toBe(false);
    expect(project.deliverables).toHaveLength(1);
    expect(project.deliverables[0].frameIds).toEqual([doc.pages[0].id]);
    expect(strFromU8(files['Kanaltexte.md'])).not.toContain('UNSELECTED');
    expect((await PDFDocument.load(files['Selected.pdf'])).getPageCount()).toBe(1);
    expect(unzipSync(files['Selected.pptx'])['ppt/slides/slide2.xml']).toBeUndefined();
    expect(unzipSync(files['Canva/Selected.pptx'])['ppt/slides/slide2.xml']).toBeUndefined();
    const xlsx = await exportDoc(doc, 'xlsx', {}, [doc.pages[0].id]);
    expect(strFromU8(unzipSync(xlsx.bytes)['xl/worksheets/sheet1.xml'])).not.toContain(
      'UNSELECTED'
    );
  });
  it('includes one PPTX and one Canva deck for mixed frame formats', async () => {
    const doc = createDocument('carousel', 'Mixed');
    doc.pages[1].format = 'square';
    const files = unzipSync((await exportDoc(doc, 'zip')).bytes);
    expect(Object.keys(files)).toEqual(
      expect.arrayContaining(['Mixed.pptx', 'Canva/Mixed.pptx', 'Canva/Canva-Import.md'])
    );
    expect(Object.keys(files).filter(file => file.endsWith('.pptx'))).toEqual([
      'Mixed.pptx',
      'Canva/Mixed.pptx',
    ]);
    for (const file of ['Mixed.pptx', 'Canva/Mixed.pptx']) {
      const slides = unzipSync(files[file]);
      expect(slides['ppt/slides/slide1.xml']).toBeDefined();
      expect(slides['ppt/slides/slide2.xml']).toBeDefined();
    }
    expect((await PDFDocument.load(files['Mixed.pdf'])).getPageCount()).toBe(doc.pages.length);
  });
  it('keeps ZIP usable and explains when a selected video exceeds the MP4 limit', async () => {
    const doc = createDocument('carousel', 'Long video');
    const document = legacyDocumentToV3(doc);
    const frames = document.nodes.filter(node => node.type === 'frame');
    document.deliverables[0].kind = 'video';
    document.deliverables[0].frameIds = frames.slice(0, 2).map(frame => frame.id);
    for (const frame of frames.slice(0, 2)) frame.duration = 31;
    const files = unzipSync(
      (
        await render(
          document,
          {},
          'zip',
          frames.slice(0, 2).map(frame => frame.id),
          temp,
          vi.fn().mockResolvedValue(undefined),
          vi.fn().mockResolvedValue(false)
        )
      ).bytes
    );
    expect(strFromU8(files['Video-Hinweis.md'])).toContain('60 Sekunden');
    expect(Object.keys(files).some(name => name.endsWith('.mp4'))).toBe(false);
    expect(files['Long-video.pdf']).toBeDefined();
  });
  it('encodes portrait frames with optional trimmed audio and reports progress', async () => {
    const doc = createDocument('video', 'Video');
    doc.pages = [doc.pages[0]];
    doc.pages[0].duration = 1;
    doc.pages[0].elements.push(element('video', { assetId: videoId, muted: false, trimStart: 1 }));
    doc.posts[0].pageIds = [doc.pages[0].id];
    const progress = vi.fn().mockResolvedValue(undefined);
    const result = await render(
      doc,
      { [videoId]: { mime: 'video/mp4', bytes: png, name: 'clip.mp4' } },
      'mp4',
      [],
      temp,
      progress,
      async () => false
    );
    expect(result.mime).toBe('video/mp4');
    expect(Buffer.from(result.bytes).toString()).toBe('encoded-video');
    expect(io.paint).toHaveBeenCalledTimes(31);
    const args = io.spawn.mock.calls.find(([, args]) =>
      args.includes('-filter_complex')
    )![1] as string[];
    expect(args.join(' ')).toContain('atrim=start=1:duration=1');
    expect(args).toContain('aac');
    expect(progress).toHaveBeenLastCalledWith(95);
  });
  it('supports silent clips and the portrait fallback sequence without claiming missing audio exists', async () => {
    const doc = createDocument('story', 'Story');
    doc.pages = [doc.pages[0]];
    doc.pages[0].duration = 1;
    doc.posts.forEach(post => {
      post.pageIds = [doc.pages[0].id];
    });
    doc.pages[0].elements.push(
      element('video', { assetId: videoId, muted: false }),
      element('video', { assetId: '33333333-3333-4333-8333-333333333333', muted: false })
    );
    audio = false;
    await exportDoc(doc, 'mp4', {
      [videoId]: { mime: 'video/mp4', bytes: png, name: 'silent.mp4' },
    });
    expect(io.spawn.mock.calls.at(-1)![1]).toContain('-an');
  });
  it('includes video posts in campaign archives and enforces duration and portrait constraints', async () => {
    const doc = createDocument('video', 'Video');
    doc.pages = [doc.pages[0]];
    doc.pages[0].duration = 1;
    doc.posts[0].pageIds = [doc.pages[0].id];
    const result = await exportDoc(doc, 'zip');
    expect(Object.keys(unzipSync(result.bytes)).some(name => name.endsWith('.mp4'))).toBe(true);
    doc.pages[0].duration = 61;
    await expect(exportDoc(doc, 'mp4')).rejects.toThrow('exceeds 60 seconds');
    doc.pages[0].duration = 1;
    doc.pages[0].format = 'feed';
    expect((await exportDoc(doc, 'mp4')).mime).toBe('video/mp4');
  });
  it('honors cancellation before rendering and during video generation and always closes Chromium', async () => {
    const doc = createDocument('video', 'Cancelled');
    doc.pages = [doc.pages[0]];
    doc.pages[0].duration = 1;
    doc.posts[0].pageIds = [doc.pages[0].id];
    await expect(exportDoc(doc, 'png', {}, [], vi.fn().mockResolvedValue(true))).rejects.toThrow(
      'Export cancelled'
    );
    await expect(
      exportDoc(doc, 'mp4', {}, [], vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true))
    ).rejects.toThrow('Export cancelled');
    expect(io.close).toHaveBeenCalledTimes(2);
    io.paint.mockRejectedValueOnce(new Error('renderer_failed'));
    await expect(exportDoc(doc, 'png')).rejects.toThrow('renderer_failed');
    expect(io.close).toHaveBeenCalledTimes(3);
  });
  it('reports encoder diagnostics and process-start failures without returning a fabricated video', async () => {
    vi.stubEnv('FFMPEG_PATH', 'configured-ffmpeg');
    await ffmpeg(['-version']);
    expect(io.spawn.mock.calls[0][0]).toBe('configured-ffmpeg');
    encoderCode = 1;
    await expect(ffmpeg(['encode'])).rejects.toThrow('Video encoding failed: encoder detail');
    spawnError = new Error('ENOENT');
    await expect(ffmpeg(['encode'])).rejects.toThrow('ENOENT');
    const doc = createDocument('story', 'Audio probe');
    doc.pages = [doc.pages[0]];
    doc.pages[0].duration = 1;
    doc.posts.forEach(post => {
      post.pageIds = [doc.pages[0].id];
    });
    doc.pages[0].elements.push(element('video', { assetId: videoId, muted: false }));
    await expect(
      exportDoc(doc, 'mp4', { [videoId]: { mime: 'video/mp4', bytes: png, name: 'clip' } })
    ).rejects.toThrow('ENOENT');
  });
});
