import { optionalFields } from './patch-schema';
import { z } from 'zod';
import {
  documentSchema,
  formats,
  elementSchema,
  tableDataSchema,
  chartDataSchema,
  type StudioDocument,
  type StudioElement,
} from './document';
const target = {
  pageId: z.string().uuid(),
  elementIds: z.array(z.string().uuid()).min(1).max(100),
};
export const studioCommandSchemas = {
  studio_format_text: z.object({
    ...target,
    range: z
      .object({
        paragraphId: z.string().uuid(),
        start: z.number().int().nonnegative(),
        end: z.number().int().nonnegative(),
      })
      .optional(),
    list: z.enum(['bullet', 'number', 'none']).optional(),
    url: z
      .string()
      .url()
      .refine(v => /^https?:/.test(v))
      .nullable()
      .optional(),
    patch: z.object(
      optionalFields(
        elementSchema.pick({
          bold: true,
          italic: true,
          underline: true,
          strikethrough: true,
          font: true,
          fontSize: true,
          fill: true,
          align: true,
          verticalAlign: true,
          lineHeight: true,
          richText: true,
        }).shape
      )
    ),
  }),
  studio_align_elements: z.object({
    ...target,
    direction: z.enum(['left', 'center', 'right', 'top', 'middle', 'bottom']),
    reference: z.enum(['page', 'selection']).optional(),
  }),
  studio_distribute_elements: z.object({ ...target, axis: z.enum(['horizontal', 'vertical']) }),
  studio_arrange_elements: z.object({
    ...target,
    action: z.enum([
      'front',
      'back',
      'forward',
      'backward',
      'group',
      'ungroup',
      'lock',
      'unlock',
      'duplicate',
      'delete',
    ]),
  }),
  studio_update_table: z.object({ ...target, table: tableDataSchema }),
  studio_update_chart: z.object({ ...target, chart: chartDataSchema }),
};
export type StudioCommandName = keyof typeof studioCommandSchemas;
export function elementBounds(e: StudioElement) {
  const r = (e.rotation * Math.PI) / 180,
    c = Math.cos(r),
    s = Math.sin(r),
    points = [
      [0, 0],
      [e.width, 0],
      [0, e.height],
      [e.width, e.height],
    ].map(([x, y]) => ({ x: e.x + x * c - y * s, y: e.y + x * s + y * c }));
  const x = Math.min(...points.map(p => p.x)),
    y = Math.min(...points.map(p => p.y));
  return {
    x,
    y,
    width: Math.max(...points.map(p => p.x)) - x,
    height: Math.max(...points.map(p => p.y)) - y,
  };
}
export function applyStudioCommand(
  input: StudioDocument,
  name: StudioCommandName,
  args: unknown,
  createId: () => string = () => crypto.randomUUID()
): StudioDocument {
  const parsed = studioCommandSchemas[name].parse(args),
    value = structuredClone(input),
    page = value.pages.find(p => p.id === parsed.pageId);
  if (!page) throw new Error('Page not found');
  if (new Set(parsed.elementIds).size !== parsed.elementIds.length)
    throw new Error('Duplicate element IDs');
  const selected = parsed.elementIds.map(id => page.elements.find(e => e.id === id));
  if (selected.some(e => !e)) throw new Error('Element not found');
  const els = selected as StudioElement[];
  if (
    els.some(e => e.locked) &&
    !(name === 'studio_arrange_elements' && 'action' in parsed && parsed.action === 'unlock')
  )
    throw new Error('Element is locked');
  if (name === 'studio_format_text') {
    const a = studioCommandSchemas.studio_format_text.parse(args);
    if (els.some(e => e.type !== 'text')) throw new Error('Select text elements');
    els.forEach(e => {
      if ((a.range || a.list || a.url !== undefined) && !e.richText.length)
        e.richText = e.text
          .split('\n')
          .map(text => ({ id: createId(), type: 'p', children: [{ text }] }));
      if (
        a.range &&
        (a.range.end <= a.range.start || !e.richText.some(p => p.id === a.range?.paragraphId))
      )
        throw new Error('Invalid text range');
      if (!a.range) Object.assign(e, a.patch);
      if (!a.patch.richText)
        for (const p of e.richText) {
          if (a.range && p.id !== a.range.paragraphId) continue;
          if (a.range && a.range.end > p.children.reduce((n, r) => n + r.text.length, 0))
            throw new Error('Text range exceeds paragraph');
          if (a.patch.align) p.align = a.patch.align;
          if (a.list === 'none') delete p.list;
          else if (a.list) p.list = a.list;
          let offset = 0;
          p.children = p.children.flatMap(run => {
            const start = offset;
            offset += run.text.length;
            const from = a.range ? Math.max(0, a.range.start - start) : 0,
              to = a.range ? Math.min(run.text.length, a.range.end - start) : run.text.length;
            if (to <= from) return [run];
            const middle = { ...run, text: run.text.slice(from, to) };
            for (const k of ['bold', 'italic', 'underline', 'strikethrough', 'fontSize'] as const)
              if (a.patch[k] !== undefined) Object.assign(middle, { [k]: a.patch[k] });
            if (a.patch.fill) middle.color = a.patch.fill;
            if (a.patch.font) middle.fontFamily = a.patch.font;
            if (a.url === null) delete middle.url;
            else if (a.url) middle.url = a.url;
            return [
              ...(from ? [{ ...run, text: run.text.slice(0, from) }] : []),
              middle,
              ...(to < run.text.length ? [{ ...run, text: run.text.slice(to) }] : []),
            ];
          });
        }
    });
  } else if (name === 'studio_align_elements') {
    const a = studioCommandSchemas.studio_align_elements.parse(args),
      boxes = els.map(elementBounds),
      [w, h] = formats[page.format];
    const ref = a.reference ?? (els.length === 1 ? 'page' : 'selection');
    const x = ref === 'page' ? 0 : Math.min(...boxes.map(b => b.x)),
      y = ref === 'page' ? 0 : Math.min(...boxes.map(b => b.y));
    const right = ref === 'page' ? w : Math.max(...boxes.map(b => b.x + b.width)),
      bottom = ref === 'page' ? h : Math.max(...boxes.map(b => b.y + b.height));
    els.forEach((e, i) => {
      const b = boxes[i];
      if (['left', 'center', 'right'].includes(a.direction))
        e.x +=
          (a.direction === 'left'
            ? x
            : a.direction === 'right'
              ? right - b.width
              : (x + right - b.width) / 2) - b.x;
      else
        e.y +=
          (a.direction === 'top'
            ? y
            : a.direction === 'bottom'
              ? bottom - b.height
              : (y + bottom - b.height) / 2) - b.y;
    });
  } else if (name === 'studio_distribute_elements') {
    if (els.length < 3) throw new Error('Select at least three elements');
    const a = studioCommandSchemas.studio_distribute_elements.parse(args),
      key = a.axis === 'horizontal' ? 'x' : 'y',
      size = key === 'x' ? 'width' : 'height';
    const ordered = els.map(e => ({ e, b: elementBounds(e) })).sort((a, b) => a.b[key] - b.b[key]);
    const first = ordered[0].b[key],
      last = ordered[ordered.length - 1].b,
      space =
        (last[key] + last[size] - first - ordered.reduce((sum, v) => sum + v.b[size], 0)) /
        (ordered.length - 1);
    let pos = first;
    for (const { e, b } of ordered) {
      e[key] += pos - b[key];
      pos += b[size] + space;
    }
  } else if (name === 'studio_arrange_elements') {
    const { action } = studioCommandSchemas.studio_arrange_elements.parse(args);
    const group = createId();
    if (action === 'delete')
      page.elements = page.elements.filter(e => !parsed.elementIds.includes(e.id));
    else if (action === 'duplicate')
      page.elements.push(
        ...els.map((e, i) => ({
          ...structuredClone(e),
          id: createId(),
          group: null,
          x: e.x + 30,
          y: e.y + 30,
          order: Math.max(...page.elements.map(e => e.order)) + i + 1,
        }))
      );
    else if (['front', 'back', 'forward', 'backward'].includes(action)) {
      let ordered = [...page.elements].sort((a, b) => a.order - b.order);
      const chosen = new Set(parsed.elementIds);
      if (action === 'front')
        ordered = [
          ...ordered.filter(e => !chosen.has(e.id)),
          ...ordered.filter(e => chosen.has(e.id)),
        ];
      else if (action === 'back')
        ordered = [
          ...ordered.filter(e => chosen.has(e.id)),
          ...ordered.filter(e => !chosen.has(e.id)),
        ];
      else {
        if (action === 'forward') ordered.reverse();
        for (let i = 1; i < ordered.length; i++)
          if (chosen.has(ordered[i].id) && !chosen.has(ordered[i - 1].id))
            [ordered[i], ordered[i - 1]] = [ordered[i - 1], ordered[i]];
        if (action === 'forward') ordered.reverse();
      }
      ordered.forEach((e, i) => (e.order = i));
    } else
      els.forEach(e => {
        if (action === 'lock' || action === 'unlock') e.locked = action === 'lock';
        else e.group = action === 'group' ? group : null;
      });
  } else if (name === 'studio_update_table') {
    if (els.some(e => e.type !== 'table')) throw new Error('Select a table');
    els.forEach(
      e => (e.table = structuredClone(studioCommandSchemas.studio_update_table.parse(args).table))
    );
  } else {
    if (els.some(e => e.type !== 'chart')) throw new Error('Select a chart');
    els.forEach(
      e => (e.chart = structuredClone(studioCommandSchemas.studio_update_chart.parse(args).chart))
    );
  }
  return documentSchema.parse(value);
}
