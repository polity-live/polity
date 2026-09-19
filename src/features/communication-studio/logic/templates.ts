import {
  defaultBrand,
  element,
  type StudioBrand,
  type StudioDocument,
  type StudioPage,
  type StudioPost,
} from './document';
export const templateNames = [
  'announcement',
  'explanation',
  'checklist',
  'invitation',
  'quote',
  'blank',
] as const;
export function makePage(
  name: string,
  format: StudioPage['format'],
  brand = defaultBrand,
  index = 0,
  template = 'announcement'
): StudioPage {
  const dark = index % 3 === 0;
  const background = dark ? brand.foreground : brand.background;
  const foreground = dark ? brand.background : brand.foreground;
  const page: StudioPage = {
    id: crypto.randomUUID(),
    name: name.slice(0, 160),
    format,
    background,
    order: index,
    duration: 5,
    transition: 'fade',
    elements:
      template === 'blank'
        ? []
        : [
            element('text', {
              text: 'Polity',
              x: 85,
              y: format === 'story' ? 270 : 90,
              width: 700,
              height: 55,
              font: brand.bodyFont,
              fontSize: 28,
              fill: foreground,
              order: 0,
            }),
            element('text', {
              text: name,
              x: 85,
              y: format === 'story' ? 440 : format === 'square' ? 210 : 250,
              width: 900,
              height: format === 'square' ? 350 : 440,
              font: brand.font,
              fontSize: 82,
              fill: foreground,
              order: 1,
            }),
            element('text', {
              text:
                template === 'checklist'
                  ? '01  Ersten Punkt ergänzen\n02  Nächsten Schritt festlegen\n03  Gemeinsam ausprobieren'
                  : 'Euren Inhalt hier ergänzen.',
              x: 85,
              y: format === 'story' ? 1100 : format === 'square' ? 640 : 850,
              width: 900,
              height: 300,
              font: brand.bodyFont,
              fontSize: 38,
              fill: foreground,
              order: 2,
            }),
            element('rect', {
              x: 85,
              y: format === 'story' ? 1620 : format === 'square' ? 980 : 1210,
              width: 910,
              height: 4,
              fill: brand.accent,
              order: 3,
            }),
            ...(brand.logoAssetId
              ? [
                  element('image', {
                    assetId: brand.logoAssetId,
                    x: 860,
                    y: format === 'story' ? 250 : 70,
                    width: 140,
                    height: 100,
                    order: 4,
                  }),
                ]
              : []),
          ],
  };
  if (template === 'quote') {
    page.elements[1].text = `„${name}“`;
    page.elements[1].align = 'center';
    page.elements[2].text = 'Name und Anlass ergänzen';
    page.elements[2].align = 'center';
  } else if (template === 'invitation') {
    page.elements[2].text = 'Datum · Uhrzeit\nOrt oder Teilnahmelink\nAnmeldung ergänzen';
    page.elements[3].height = 12;
  } else if (template === 'explanation') {
    page.elements[0].text = 'SCHRITT ' + String(index + 1).padStart(2, '0');
    page.elements[3].width = 220;
  }
  return page;
}
export function createDocument(
  kind: StudioDocument['kind'],
  title: string,
  brand: StudioBrand = defaultBrand,
  weeks = 4,
  template = 'announcement',
  counts = { core: 3, stories: 2 }
): StudioDocument {
  const pages: StudioPage[] = [],
    posts: StudioPost[] = [];
  function addPost(k: StudioPost['kind'], name: string, day: number, code: string) {
    const n = k === 'carousel' ? 5 : k === 'story' ? 3 : k === 'video' ? 5 : 1;
    const children = Array.from({ length: n }, (_, i) =>
      makePage(
        i === 0
          ? name
          : i === n - 1
            ? 'Gemeinsam den nächsten Schritt gehen'
            : `${name} · ${i + 1}`,
        k === 'story' || k === 'video' ? 'story' : 'feed',
        brand,
        pages.length + i,
        template
      )
    );
    pages.push(...children);
    posts.push({
      id: crypto.randomUUID(),
      code,
      title: name,
      kind: k,
      pageIds: children.map(p => p.id),
      day,
      action: '',
      status: 'draft',
      assignee: '',
      captions: { instagram: '', linkedin: '', facebook: '' },
    });
  }
  if (kind === 'campaign')
    for (let w = 0; w < Math.max(1, Math.min(12, weeks)); w++) {
      for (let i = 0; i < counts.core; i++) {
        const k = (['carousel', 'video', 'single'] as const)[i % 3];
        addPost(k, `${title} · Woche ${w + 1}`, w * 7 + Math.min(i * 2, 6), `W${w + 1}-${i + 1}`);
      }
      for (let i = 0; i < counts.stories; i++)
        addPost(
          'story',
          `${title} · Story ${i + 1}`,
          w * 7 + Math.min(i * 2 + 1, 6),
          `W${w + 1}-S${i + 1}`
        );
    }
  else addPost(kind === 'event' ? 'single' : kind, title, 0, '01');
  return { version: 1, title, kind, brand, pages, posts, startDate: '', source: null };
}
