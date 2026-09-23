import { studioV5RenderBundle } from './studio-v5-render-bundle';
import { editableV5Layers } from './editable-v5-layers';
import { fitWhiteboardExport } from './canvas-export-layout';
import { chromium } from 'playwright';
import PptxGenJS from 'pptxgenjs';
import ExcelJS from 'exceljs';
import { PDFDocument } from 'pdf-lib';
import { zipSync, strToU8 } from 'fflate';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import {
  studioDocumentV3Schema,
  type StudioDocumentV3,
} from '../../src/features/communication-studio/logic/document-v3';
import {
  legacyDocumentToV3,
  v3DocumentToLegacy,
} from '../../src/features/communication-studio/logic/v3-adapter';
import { mediaDrawGeometry } from '../../src/features/communication-studio/logic/media-geometry';
import {
  formats,
  channels,
  dateForDay,
  type StudioDocument,
  type StudioPage,
} from '../../src/features/communication-studio/logic/document';
export type MediaMap = Record<string, { mime: string; bytes: Uint8Array; name: string }>;
export interface ExportResult {
  bytes: Uint8Array;
  name: string;
  mime: string;
}
const pad = (i: number) => String(i + 1).padStart(3, '0');
const slug = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .slice(0, 70) || 'polity';
export const pageFile = (p: StudioPage, index: number) => `${pad(index)}-${slug(p.name)}.png`;
export function selectStudioExportDocument(document: StudioDocumentV3, selected: string[]) {
  const roots = document.nodes.filter(
    node =>
      node.type === 'frame' &&
      node.parentFrameId === null &&
      node.id !== document.masterLayout.frameId
  );
  const available = new Set(roots.map(frame => frame.id));
  if (selected.some(id => !available.has(id)))
    throw new Error('A selected Studio frame no longer exists or cannot be exported.');
  const selectedIds = new Set(selected.length ? selected : roots.map(frame => frame.id));
  if (!selectedIds.size) throw new Error('Select at least one frame to export.');
  const retained = new Set(selectedIds);
  if (document.masterLayout.frameId) retained.add(document.masterLayout.frameId);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of document.nodes)
      if (node.parentFrameId && retained.has(node.parentFrameId) && !retained.has(node.id)) {
        retained.add(node.id);
        changed = true;
      }
  }
  return studioDocumentV3Schema.parse({
    ...document,
    nodes: document.nodes.filter(node => retained.has(node.id)),
    deliverables: document.deliverables
      .map(deliverable => ({
        ...deliverable,
        frameIds: deliverable.frameIds.filter(id => selectedIds.has(id)),
      }))
      .filter(deliverable => deliverable.frameIds.length),
    componentInstances: document.componentInstances.filter(instance =>
      Object.values(instance.sourceToInstance).some(id => retained.has(id))
    ),
  });
}
export async function workbook(doc: StudioDocument, originalPageIndex?: Map<string, number>) {
  const book = new ExcelJS.Workbook();
  book.creator = 'Polity';
  const plan = book.addWorksheet('Redaktionsplan');
  plan.addRow(['Kampagnenstart', doc.startDate ? new Date(doc.startDate + 'T12:00:00Z') : null]);
  plan.getCell('B1').numFmt = 'dd.mm.yyyy';
  plan.addRow([
    'ID',
    'Tag',
    'Datum',
    'Kanal',
    'Format',
    'Titel',
    'Status',
    'Zuständig',
    'Hauptaktion',
    'Dateien',
  ]);
  const text = book.addWorksheet('Kanaltexte');
  text.addRow(['ID', 'Kanal', 'Text']);
  const stats = book.addWorksheet('Auswertung');
  stats.addRow(['ID', 'Kanal', 'Reichweite', 'Gespeichert', 'Linkklicks', 'Anfragen', 'Notizen']);
  for (const post of doc.posts)
    for (const channel of channels) {
      const row = plan.addRow([
        post.code,
        post.day,
        null,
        channel,
        post.kind,
        post.title,
        post.status,
        post.assignee,
        post.action,
        post.pageIds
          .map(id => {
            const i = doc.pages.findIndex(p => p.id === id);
            return i < 0 ? '' : pageFile(doc.pages[i], originalPageIndex?.get(id) ?? i);
          })
          .join('\n'),
      ]);
      row.getCell(3).value = {
        formula: `IF($B$1="","",$B$1+B${row.number})`,
        result: doc.startDate ? new Date(dateForDay(doc.startDate, post.day) + 'T12:00:00Z') : '',
      };
      row.getCell(3).numFmt = 'dd.mm.yyyy';
      text.addRow([post.code, channel, post.captions[channel]]);
      stats.addRow([post.code, channel, null, null, null, null, '']);
    }
  for (const sheet of book.worksheets) {
    sheet.views = [{ state: 'frozen', ySplit: sheet === plan ? 2 : 1 }];
    sheet.columns.forEach((c, i) => {
      c.width = i > 4 ? 35 : 20;
    });
    sheet.eachRow(row => {
      row.alignment = { vertical: 'top', wrapText: true };
    });
    const header = sheet.getRow(sheet === plan ? 2 : 1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF12362D' } };
  }
  return new Uint8Array(await book.xlsx.writeBuffer());
}
async function fonts() {
  let css = '';
  for (const font of [
    'newsreader',
    'manrope',
    'inter',
    'open-sans',
    'ibm-plex-serif',
    'public-sans',
    'pt-sans',
    'work-sans',
    'ubuntu',
    'jetbrains-mono',
  ])
    for (const weight of [400, 700])
      for (const style of ['normal', 'italic']) {
        try {
          const file = await readFile(
            path.resolve(
              'node_modules/@fontsource',
              font,
              'files',
              `${font}-latin-${weight}-${style}.woff2`
            )
          );
          const names: Record<string, string> = {
            'ibm-plex-serif': 'IBM Plex Serif',
            'open-sans': 'Open Sans',
            'pt-sans': 'PT Sans',
            'public-sans': 'Public Sans',
            'work-sans': 'Work Sans',
            'jetbrains-mono': 'JetBrains Mono',
          };
          css += `@font-face{font-family:"${names[font] || font}";font-weight:${weight};font-style:${style};src:url(data:font/woff2;base64,${file.toString('base64')})}`;
        } catch {
          /* Unsupported installed weight falls back to the same family's 400 face. */
        }
      }
  return css;
}
export async function render(
  input: StudioDocument | StudioDocumentV3,
  media: MediaMap,
  format: string,
  selected: string[],
  workdir: string,
  progress: (n: number) => Promise<void>,
  cancelled: () => Promise<boolean>
): Promise<ExportResult> {
  const sourceDocument = 'schemaVersion' in input ? input : legacyDocumentToV3(input);
  const originalPageIndex = new Map(
    sourceDocument.nodes
      .filter(
        node =>
          node.type === 'frame' &&
          node.parentFrameId === null &&
          node.id !== sourceDocument.masterLayout.frameId
      )
      .sort((left, right) => left.zIndex - right.zIndex || left.id.localeCompare(right.id))
      .map((frame, index) => [frame.id, index] as const)
  );
  const v5Document = selectStudioExportDocument(sourceDocument, selected);
  const doc: StudioDocument = v3DocumentToLegacy(v5Document, { includeMaster: true });
  const pages = doc.kind === 'whiteboard' ? doc.pages.map(fitWhiteboardExport) : doc.pages;
  const name = slug(doc.title);
  if (format === 'xlsx')
    return {
      bytes: await workbook(doc, originalPageIndex),
      name: name + '.xlsx',
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  await mkdir(workdir, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.STUDIO_CHROMIUM_PATH || undefined,
    args: ['--no-sandbox'],
  });
  const tab = await browser.newPage();
  await tab.route('**/*', r => r.abort());
  const images: Record<string, Uint8Array> = {};
  const data = Object.fromEntries(
    Object.entries(media).map(([id, m]) => [
      id,
      `data:${m.mime};base64,${Buffer.from(m.bytes).toString('base64')}`,
    ])
  );
  try {
    await tab.setContent(
      `<html><head><style>${await fonts()}body{margin:0}</style></head><body><canvas></canvas></body></html>`
    );
    await tab.addScriptTag({ content: await studioV5RenderBundle() });
    await tab.evaluate(async () => {
      for (const font of [
        'Newsreader',
        'Manrope',
        'Inter',
        'Open Sans',
        'IBM Plex Serif',
        'Public Sans',
        'PT Sans',
        'Work Sans',
        'Ubuntu',
        'JetBrains Mono',
      ])
        for (const weight of [400, 700]) await document.fonts.load(`${weight} 40px "${font}"`);
    });
    const frame = async (p: StudioPage, time = 1, _animateScene = false) => {
      const url = await tab.evaluate(
        async ({ p, data, time, v5Document }) =>
          (window as any).PolityStudioV5Renderer.renderFrame(v5Document, p.id, data, time),
        { p: p as any, data, time, v5Document: v5Document as any }
      );
      return new Uint8Array(Buffer.from(url.split(',')[1], 'base64'));
    };
    for (let i = 0; i < pages.length; i++) {
      if (await cancelled()) throw new Error('Export cancelled');
      images[pages[i].id] = await frame(pages[i]);
      await progress(Math.round(5 + (35 * (i + 1)) / pages.length));
    }
    const files: Record<string, Uint8Array> = {};
    const addPng = () => {
      for (const p of pages)
        files[
          'PNG/' +
            pageFile(p, originalPageIndex.get(p.id) ?? doc.pages.findIndex(x => x.id === p.id))
        ] = images[p.id];
    };
    const addPdf = async () => {
      const pdf = await PDFDocument.create();
      for (const p of pages) {
        const [w, h] = formats[p.format];
        const img = await pdf.embedPng(images[p.id]);
        pdf
          .addPage([w * 0.75, h * 0.75])
          .drawImage(img, { x: 0, y: 0, width: w * 0.75, height: h * 0.75 });
      }
      files[name + '.pdf'] = await pdf.save();
    };
    const addPpt = async () => {
      for (const f of [...new Set(pages.map(p => p.format))]) {
        const ppt = new PptxGenJS();
        const [w, h] = formats[f];
        ppt.defineLayout({ name: 'Polity', width: w / 144, height: h / 144 });
        ppt.layout = 'Polity';
        ppt.author = 'Polity';
        ppt.subject = doc.title;
        for (const p of pages.filter(p => p.format === f)) {
          const slide = ppt.addSlide();
          slide.background = { color: p.background.slice(1) };
          slide.addNotes(`Dauer: ${p.duration}s. Animationen: MP4. ${p.name}`);
          for (const layer of editableV5Layers(v5Document, p.id)) {
            if (layer.kind === 'drawing') {
              const { node, matrix } = layer;
              const points = node.points.map(([x, y]) => `${x},${y}`).join(' ');
              const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline points="${points}" fill="none" stroke="${node.style.stroke ?? '#12362D'}" stroke-width="${Math.max(2, node.style.strokeWidth)}" stroke-linecap="round" stroke-linejoin="round" opacity="${node.style.opacity}" transform="matrix(${matrix.join(' ')})"/></svg>`;
              slide.addImage({
                data: 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64'),
                x: 0,
                y: 0,
                w: w / 144,
                h: h / 144,
              });
              continue;
            }
            const e = layer.element;
            const box = {
              x:
                (e.x +
                  ((Math.cos((e.rotation * Math.PI) / 180) - 1) * e.width) / 2 -
                  (Math.sin((e.rotation * Math.PI) / 180) * e.height) / 2) /
                144,
              y:
                (e.y +
                  (Math.sin((e.rotation * Math.PI) / 180) * e.width) / 2 +
                  ((Math.cos((e.rotation * Math.PI) / 180) - 1) * e.height) / 2) /
                144,
              w: e.width / 144,
              h: e.height / 144,
              rotate: e.rotation,
              transparency: (1 - e.opacity) * 100,
            };
            if (e.type === 'text')
              slide.addText(
                e.richText.length
                  ? e.richText.flatMap((p, i) =>
                      p.children.map((r, j) => ({
                        text: r.text,
                        options: {
                          align: p.align ?? e.align,
                          bold: r.bold ?? e.bold,
                          italic: r.italic ?? e.italic,
                          underline:
                            (r.underline ?? e.underline) ? { style: 'sng' as const } : undefined,
                          strike:
                            (r.strikethrough ?? e.strikethrough)
                              ? ('sngStrike' as const)
                              : undefined,
                          color: (r.color ?? e.fill).slice(1),
                          fontFace: r.fontFamily ?? e.font,
                          fontSize: (r.fontSize ?? e.fontSize) / 2,
                          hyperlink: r.url ? { url: r.url } : undefined,
                          breakLine: j === p.children.length - 1 && i < e.richText.length - 1,
                          bullet:
                            p.list === 'bullet'
                              ? {}
                              : p.list === 'number'
                                ? { type: 'number' as const }
                                : undefined,
                        },
                      }))
                    )
                  : e.text,
                {
                  ...box,
                  fontFace: e.font,
                  fontSize: e.fontSize / 2,
                  bold: e.bold,
                  italic: e.italic,
                  underline: e.underline ? { style: 'sng' } : undefined,
                  strike: e.strikethrough ? 'sngStrike' : undefined,
                  valign: e.verticalAlign,
                  color: e.fill.slice(1),
                  align: e.align,
                  margin: 0,
                  breakLine: false,
                  lineSpacingMultiple: e.lineHeight,
                }
              );
            else if (e.type === 'table' && e.table) {
              const table = e.table;
              slide.addTable(
                table.rows.map(r =>
                  r.cells.map(c => ({
                    text: c.text,
                    options: {
                      fill: { color: c.fill.slice(1), transparency: (1 - e.opacity) * 100 },
                      color: c.color.slice(1),
                      align: c.align,
                      bold: c.bold,
                      border: (['top', 'right', 'bottom', 'left'] as const).map(side =>
                        c.borders?.[side] === false
                          ? { type: 'none' as const, pt: 0 }
                          : { type: 'solid' as const, color: table.border.slice(1), pt: 1 }
                      ) as [
                        { type: 'none' | 'solid'; pt: number; color?: string },
                        { type: 'none' | 'solid'; pt: number; color?: string },
                        { type: 'none' | 'solid'; pt: number; color?: string },
                        { type: 'none' | 'solid'; pt: number; color?: string },
                      ],
                    },
                  }))
                ),
                {
                  ...box,
                  colW: table.widths.map(
                    v => (box.w * v) / table.widths.reduce((a, b) => a + b, 0)
                  ),
                  rowH: box.h / table.rows.length,
                  fontFace: e.font,
                  fontSize: e.fontSize / 2,
                  margin: 3,
                  autoPage: false,
                }
              );
            } else if (e.type === 'chart' && e.chart)
              slide.addChart(
                e.chart.kind,
                e.chart.series.map(s => ({
                  name: s.name,
                  labels: e.chart?.labels ?? [],
                  values: s.values,
                })),
                {
                  ...box,
                  showLegend: e.chart.legend,
                  showTitle: false,
                  chartColors:
                    e.chart.kind === 'pie'
                      ? (
                          e.chart.colors ?? [
                            '#B88A3B',
                            '#12362D',
                            '#588DB2',
                            '#9A597F',
                            '#75965D',
                            '#D46E48',
                          ]
                        ).map(c => c.slice(1))
                      : e.chart.series.map(s => s.color.slice(1)),
                  showValue: false,
                  catAxisLabelFontSize: 10,
                  valAxisLabelFontSize: 10,
                }
              );
            else if (e.type === 'line' || e.type === 'arrow')
              slide.addShape(ppt.ShapeType.line, {
                ...box,
                line: {
                  color: e.stroke.slice(1),
                  width: Math.max(1, e.strokeWidth) / 2,
                  endArrowType: e.type === 'arrow' ? 'triangle' : undefined,
                },
              });
            else if (e.type === 'rect' || e.type === 'ellipse')
              slide.addShape(
                e.type === 'ellipse'
                  ? ppt.ShapeType.ellipse
                  : 'node' in layer && layer.node.type === 'shape' && layer.node.shape === 'diamond'
                    ? ppt.ShapeType.diamond
                    : 'node' in layer &&
                        layer.node.type === 'shape' &&
                        layer.node.shape === 'rounded-rectangle'
                      ? ppt.ShapeType.roundRect
                      : ppt.ShapeType.rect,
                {
                  ...box,
                  fill: { color: e.fill.slice(1), transparency: (1 - e.opacity) * 100 },
                  line: {
                    color: e.stroke.slice(1),
                    transparency: e.strokeWidth ? 0 : 100,
                    width: e.strokeWidth / 2,
                  },
                }
              );
            else if (e.assetId && media[e.assetId]) {
              const m = media[e.assetId];
              if (e.type === 'video' && !e.crop && format !== 'canva')
                slide.addMedia({
                  ...box,
                  type: 'video',
                  data: `${m.mime};base64,${Buffer.from(m.bytes).toString('base64')}`,
                  extn: 'mp4',
                });
              else {
                const raster = await tab.evaluate(
                  async ({ id, url, video, seek }) => {
                    let source = (window as any).__studioMedia?.[id] as
                      HTMLImageElement | HTMLVideoElement | undefined;
                    if (!source) {
                      source = video ? document.createElement('video') : new Image();
                      const loading = source;
                      await new Promise<void>((resolve, reject) => {
                        loading.onerror = () => reject(new Error('Media could not be decoded'));
                        if (loading instanceof HTMLVideoElement) {
                          loading.muted = true;
                          loading.preload = 'auto';
                          loading.onloadeddata = () => resolve();
                        } else loading.onload = () => resolve();
                        loading.src = url;
                      });
                    }
                    ((window as any).__studioMedia ??= {})[id] = source;
                    if (source instanceof HTMLVideoElement && seek > 0) {
                      const target = Math.min(seek, Math.max(0, source.duration - 0.05));
                      if (target > 0)
                        await new Promise<void>(resolve => {
                          source.onseeked = () => resolve();
                          source.currentTime = target;
                        });
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width =
                      source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth;
                    canvas.height =
                      source instanceof HTMLVideoElement
                        ? source.videoHeight
                        : source.naturalHeight;
                    const context = canvas.getContext('2d');
                    if (!context) throw new Error('Canvas unavailable');
                    context.drawImage(source, 0, 0);
                    return {
                      width: canvas.width,
                      height: canvas.height,
                      data: canvas.toDataURL('image/png'),
                    };
                  },
                  {
                    id: e.assetId,
                    url: data[e.assetId],
                    video: e.type === 'video',
                    seek: e.trimStart + 1,
                  }
                );
                const placement = mediaDrawGeometry(e, raster.width, raster.height);
                const poster = await tab.evaluate(
                  ({ id, width, height, placement }) => {
                    const source = (window as any).__studioMedia[id] as
                      HTMLImageElement | HTMLVideoElement;
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.max(1, Math.round(width));
                    canvas.height = Math.max(1, Math.round(height));
                    const context = canvas.getContext('2d');
                    if (!context) throw new Error('Canvas unavailable');
                    context.drawImage(
                      source,
                      placement.x,
                      placement.y,
                      placement.width,
                      placement.height
                    );
                    return canvas.toDataURL('image/png');
                  },
                  { id: e.assetId, width: e.width, height: e.height, placement }
                );
                slide.addImage({ ...box, data: poster, flipH: e.flipX, flipV: e.flipY });
                if (e.type === 'video' && e.crop && (format === 'pptx' || format === 'canva'))
                  files[`Medien/${e.assetId}.mp4`] = m.bytes;
              }
            }
          }
        }
        files[`${name}-${f}.pptx`] = new Uint8Array(
          (await ppt.write({ outputType: 'uint8array' })) as Uint8Array
        );
      }
    };
    const addVideo = async () => {
      const posts = doc.posts.filter(
        p => p.kind === 'video' && p.pageIds.some(id => pages.some(x => x.id === id))
      );
      const sequences = posts.length
        ? posts.map(post => ({
            name: post.code,
            pages: pages.filter(p => post.pageIds.includes(p.id)),
          }))
        : [{ name: 'video', pages }];
      for (const seq of sequences) {
        const seconds = seq.pages.reduce((sum, p) => sum + p.duration, 0);
        if (seconds > 60) throw new Error('Video exceeds 60 seconds. Select one video post.');
        if (seq.pages.some(p => p.format !== seq.pages[0].format))
          throw new Error('Video pages must have the same format');
        let index = 0;
        const directory = path.join(workdir, slug(seq.name));
        await mkdir(directory, { recursive: true });
        for (const p of seq.pages)
          for (let i = 0; i < Math.round(p.duration * 30); i++) {
            if (i % 30 === 0) {
              if (await cancelled()) throw new Error('Export cancelled');
              await progress(40 + Math.round((index / (seconds * 30)) * 50));
            }
            await writeFile(
              path.join(directory, `${String(index++).padStart(5, '0')}.png`),
              await frame(p, i / 30, true)
            );
          }
        const dest = path.join(directory, 'video.mp4');
        const audioInputs: string[] = [],
          filters: string[] = [];
        let offset = 0;
        for (const p of seq.pages) {
          for (const e of p.elements.filter(e => e.type === 'video' && !e.muted && e.assetId)) {
            const m = media[e.assetId as string];
            if (!m) continue;
            const input = path.join(directory, `audio-${audioInputs.length}.mp4`);
            await writeFile(input, m.bytes);
            if (!(await hasAudio(input))) continue;
            const i = audioInputs.length + 1;
            audioInputs.push(input);
            filters.push(
              `[${i}:a]atrim=start=${e.trimStart}:duration=${p.duration},asetpts=PTS-STARTPTS,adelay=${Math.round(offset * 1000)}:all=1[a${i}]`
            );
          }
          offset += p.duration;
        }
        const audioArgs = audioInputs.length
          ? [
              ...audioInputs.flatMap(file => ['-i', file]),
              '-filter_complex',
              filters.join(';') +
                ';' +
                audioInputs.map((_, i) => `[a${i + 1}]`).join('') +
                `amix=inputs=${audioInputs.length}:normalize=0,apad,atrim=duration=${seconds}[audio]`,
              '-map',
              '0:v',
              '-map',
              '[audio]',
              '-c:a',
              'aac',
            ]
          : ['-an'];
        await ffmpeg([
          '-y',
          '-framerate',
          '30',
          '-i',
          path.join(directory, '%05d.png'),
          ...audioArgs,
          '-c:v',
          'libx264',
          '-pix_fmt',
          'yuv420p',
          '-crf',
          '20',
          '-movflags',
          '+faststart',
          dest,
        ]);
        files[`${slug(seq.name)}.mp4`] = new Uint8Array(await readFile(dest));
      }
    };
    if (format === 'png' || format === 'zip') addPng();
    if (format === 'pdf' || format === 'zip') await addPdf();
    if (['pptx', 'canva', 'zip'].includes(format)) await addPpt();
    if (format === 'mp4' || (format === 'zip' && doc.posts.some(p => p.kind === 'video')))
      await addVideo();
    if (format === 'canva')
      files['Canva-Import.md'] = strToU8(
        'PowerPoint-Datei in Canva importieren. Texte und Formen sind bearbeitbar. Schriftarten, Bildausschnitte und Videoposter prüfen. Animationen liegen in MP4 vor.'
      );
    if (format === 'zip') {
      files['Polity-Projekt.json'] = strToU8(JSON.stringify(v5Document));
      for (const [id, m] of Object.entries(media))
        files[
          `Medien/${id}.${m.mime === 'video/mp4' ? 'mp4' : m.mime === 'image/jpeg' ? 'jpg' : m.mime === 'image/webp' ? 'webp' : 'png'}`
        ] = m.bytes;
      files['Kampagnenplan.xlsx'] = await workbook(doc, originalPageIndex);
      files['Kanaltexte.md'] = strToU8(
        doc.posts
          .map(
            p =>
              `# ${p.code} · ${p.title}\n\n${channels.map(c => `## ${c}\n\n${p.captions[c]}`).join('\n\n')}`
          )
          .join('\n\n')
      );
    }
    await progress(95);
    const entries = Object.entries(files);
    if (entries.length === 1) {
      const [filename, bytes] = entries[0];
      return {
        bytes,
        name: path.posix.basename(filename),
        mime: filename.endsWith('.png')
          ? 'image/png'
          : filename.endsWith('.pdf')
            ? 'application/pdf'
            : filename.endsWith('.mp4')
              ? 'video/mp4'
              : 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      };
    }
    return { bytes: zipSync(files, { level: 4 }), name: name + '.zip', mime: 'application/zip' };
  } finally {
    await browser.close();
  }
}
async function hasAudio(file: string) {
  return new Promise<boolean>((resolve, reject) => {
    const child = spawn(process.env.FFMPEG_PATH || 'ffmpeg', ['-i', file], {
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let info = '';
    child.stderr.on('data', d => {
      info = (info + d.toString()).slice(-10000);
    });
    child.on('error', reject);
    child.on('close', () => resolve(/Stream[^\n]+Audio:/.test(info)));
  });
}
export async function ffmpeg(args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.env.FFMPEG_PATH || 'ffmpeg', args, {
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let error = '';
    child.stderr.on('data', d => {
      error = (error + d.toString()).slice(-2000);
    });
    child.on('error', reject);
    child.on('close', code =>
      code === 0 ? resolve() : reject(new Error('Video encoding failed: ' + error))
    );
  });
}
