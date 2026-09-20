import { EventEmitter } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import { PDFDocument } from 'pdf-lib';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocument } from '../../../src/features/communication-studio/logic/templates';
import { element } from '../../../src/features/communication-studio/logic/document';
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
import { ffmpeg, pageFile, render } from '../exporters';
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
    __studioMedia: { [imageId]: { naturalWidth: 200, naturalHeight: 100 }, [videoId]: new Video() },
  });
  io.paint.mockResolvedValue(pngUrl);
  io.evaluate.mockImplementation(async (fn: unknown, arg: unknown) =>
    typeof fn === 'function' ? fn(arg) : undefined
  );
  io.route.mockImplementation(async (_pattern, body) => body({ abort: vi.fn() }));
  io.launch.mockResolvedValue({
    newPage: async () => ({ route: io.route, setContent: io.content, evaluate: io.evaluate }),
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
describe('Studio export artifacts', () => {
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
    expect(io.paint.mock.calls[0][0].id).toBe(doc.pages[1].id);
    expect(io.close).toHaveBeenCalledTimes(1);
    expect(pageFile({ ...doc.pages[0], name: '' }, 0)).toBe('001-polity.png');
  });
  it('exports multi-page PNG archives and PDF pages with their exact requested dimensions', async () => {
    const doc = createDocument('carousel', 'Deck');
    doc.pages[1].format = 'square';
    const archive = await exportDoc(doc, 'png');
    const files = unzipSync(archive.bytes);
    expect(Object.keys(files)).toHaveLength(doc.pages.length);
    expect(Object.keys(files)[0]).toMatch(/^PNG\/001-/);
    const result = await exportDoc(doc, 'pdf');
    const pdf = await PDFDocument.load(result.bytes);
    expect(pdf.getPageCount()).toBe(doc.pages.length);
    expect(pdf.getPage(0).getSize()).toEqual({ width: 810, height: 1012.5 });
    expect(pdf.getPage(1).getSize()).toEqual({ width: 810, height: 810 });
    expect(result.mime).toBe('application/pdf');
  });
  it('keeps PowerPoint text and shapes editable and embeds media while preserving grouped output formats', async () => {
    const doc = createDocument('single', 'Editable');
    doc.pages[0].elements.push(
      element('ellipse', { rotation: 25, opacity: 0.5 }),
      element('image', { assetId: imageId, fit: 'contain' }),
      element('video', { assetId: videoId }),
      element('image')
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
    doc.pages.push({ ...structuredClone(doc.pages[0]), id: crypto.randomUUID(), format: 'square' });
    const multiple = await exportDoc(doc, 'pptx', media);
    expect(
      Object.keys(unzipSync(multiple.bytes)).filter(name => name.endsWith('.pptx'))
    ).toHaveLength(2);
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
    const ppt = unzipSync(files['Canva-feed.pptx']);
    expect(Object.keys(ppt).some(name => name.endsWith('.mp4'))).toBe(false);
    expect(
      Object.keys(ppt).some(name => name.startsWith('ppt/media/') && name.endsWith('.png'))
    ).toBe(true);
  });
  it('creates a complete campaign archive with media, channel captions, calendar and presentation', async () => {
    const doc = createDocument('single', 'Campaign');
    const media = Object.fromEntries(
      ['image/png', 'image/jpeg', 'image/webp', 'video/mp4'].map((mime, index) => [
        String(index),
        { mime, bytes: png, name: 'source' },
      ])
    );
    const result = await exportDoc(doc, 'zip', media);
    const files = unzipSync(result.bytes);
    expect(Object.keys(files)).toEqual(
      expect.arrayContaining([
        'Medien/0.png',
        'Medien/1.jpg',
        'Medien/2.webp',
        'Medien/3.mp4',
        'Kampagnenplan.xlsx',
        'Kanaltexte.md',
        'Campaign.pdf',
        'Campaign-feed.pptx',
      ])
    );
    expect(strFromU8(files['Kanaltexte.md'])).toContain('instagram');
    expect(Object.keys(unzipSync(files['Kampagnenplan.xlsx']))).toContain('xl/workbook.xml');
    const excel = await exportDoc(doc, 'xlsx');
    expect(excel.name).toBe('Campaign.xlsx');
    expect(excel.mime).toContain('spreadsheet');
  });
  it('encodes portrait frames with optional trimmed audio and reports progress', async () => {
    const doc = createDocument('video', 'Video');
    doc.pages = [doc.pages[0]];
    doc.pages[0].duration = 0.1;
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
    expect(io.paint.mock.calls.filter(([, , , animate]) => animate)).toHaveLength(3);
    const args = io.spawn.mock.calls.find(([, args]) =>
      args.includes('-filter_complex')
    )![1] as string[];
    expect(args.join(' ')).toContain('atrim=start=1:duration=0.1');
    expect(args).toContain('aac');
    expect(progress).toHaveBeenLastCalledWith(95);
  });
  it('supports silent clips and the portrait fallback sequence without claiming missing audio exists', async () => {
    const doc = createDocument('story', 'Story');
    doc.pages = [doc.pages[0]];
    doc.pages[0].duration = 0.1;
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
    doc.pages[0].duration = 0.1;
    doc.posts[0].pageIds = [doc.pages[0].id];
    const result = await exportDoc(doc, 'zip');
    expect(Object.keys(unzipSync(result.bytes)).some(name => name.endsWith('.mp4'))).toBe(true);
    doc.pages[0].duration = 61;
    await expect(exportDoc(doc, 'mp4')).rejects.toThrow('Video exceeds 60 seconds');
    doc.pages[0].duration = 0.1;
    doc.pages[0].format = 'feed';
    await expect(exportDoc(doc, 'mp4')).rejects.toThrow('Video requires portrait pages');
  });
  it('honors cancellation before rendering and during video generation and always closes Chromium', async () => {
    const doc = createDocument('video', 'Cancelled');
    doc.pages = [doc.pages[0]];
    doc.pages[0].duration = 0.1;
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
    doc.pages[0].duration = 0.1;
    doc.pages[0].elements.push(element('video', { assetId: videoId, muted: false }));
    await expect(
      exportDoc(doc, 'mp4', { [videoId]: { mime: 'video/mp4', bytes: png, name: 'clip' } })
    ).rejects.toThrow('ENOENT');
  });
});
