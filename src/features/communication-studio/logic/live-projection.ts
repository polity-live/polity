import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { richTextNodeSchema, type StudioDocumentV3, type StudioNode } from './document-v3';
import { type LiveSource, type LiveResult, type LiveBinding } from './live-contract';
import { activePalette, paletteColor, themeFontFamily } from './theme';
import { computeVoteResultSummary } from '@/features/vote-cast/logic/computeVoteResults';
import { getWinningCandidateIds } from '@/features/agendas/logic/getWinningCandidateIds';
import { frameIntro } from './event-intro';

export function liveSourceKey(type: string, id: string) {
  return `${type}:${id}`;
}
export function resultSourceRefs(sources: readonly LiveSource[]) {
  return [
    ...new Map(
      sources.flatMap(s => {
        const type = s.payload.result_source_type,
          id = s.payload.result_source_id;
        return (type === 'vote' || type === 'election') && typeof id === 'string'
          ? [[`${type}:${id}`, { type, id }] as const]
          : [];
      })
    ).values(),
  ];
}
export function hydrateLiveSources(sources: readonly LiveSource[]): LiveSource[] {
  const lookup = new Map(sources.map(s => [liveSourceKey(s.source_type, s.source_id), s]));
  return sources.map(s =>
    typeof s.payload.result_source_id === 'string'
      ? {
          ...s,
          payload: {
            ...s.payload,
            results:
              lookup.get(
                liveSourceKey(String(s.payload.result_source_type), s.payload.result_source_id)
              )?.payload.results ?? null,
          },
        }
      : s
  );
}
export function countdownText(target: number, now: number): string {
  const seconds = Math.max(0, Math.ceil((target - now) / 1000));
  const days = Math.floor(seconds / 86400);
  const clock = [
    Math.floor((seconds % 86400) / 3600),
    Math.floor((seconds % 3600) / 60),
    seconds % 60,
  ]
    .map(n => String(n).padStart(2, '0'))
    .join(':');
  return days
    ? translateText('features.studio.eventLive.dayCountdown', { days, time: clock })
    : clock;
}
export function resultSummary(result: LiveResult) {
  const total = result.options.reduce(
    (n, o) => n + (result.status === 'indicative' ? o.indicative : o.final),
    0
  );
  if (!['closed', 'no_winner', 'runoff_required'].includes(result.status))
    return translateText('features.studio.eventLive.resultCount', {
      title: result.title,
      status: result.status,
      count: total,
    });
  if (result.election_mode) {
    if (result.status === 'no_winner')
      return `${result.title} · ${translateText('features.studio.eventLive.noWinner')}`;
    if (result.status === 'runoff_required')
      return `${result.title} · ${translateText('features.studio.eventLive.runoff')}`;
    const ids = getWinningCandidateIds({
      candidateStats: result.options.map((o, i) => ({
        candidate: { id: o.id, order_index: i },
        finalCount: o.final,
      })),
      electionMode: result.election_mode === 'list' ? 'list' : 'single',
      seatCount: result.seat_count,
    });
    const selected = result.options.filter(o => ids.includes(o.id));
    if (!selected.length)
      return `${result.title} · ${result.options.some(o => o.final > 0) ? translateText('features.studio.eventLive.runoff') : translateText('features.studio.eventLive.noWinner')}`;
    return translateText('features.studio.eventLive.resultCount', {
      title: result.title,
      status: selected.map(o => o.label).join(', '),
      count: total,
    });
  }
  const summary = computeVoteResultSummary(
    result.options.map((o, i) => ({ id: o.id, label: o.label, order_index: i })),
    [],
    result.eligible,
    result.majority_type === 'absolute' || result.majority_type === 'two_thirds'
      ? result.majority_type
      : 'simple',
    result.options.map(o => ({ choice_id: o.id, phase: 'final', count: o.final }))
  );
  return translateText('features.studio.eventLive.resultCount', {
    title: result.title,
    status: translateText(
      summary.result === 'passed'
        ? 'features.studio.eventLive.passed'
        : summary.result === 'rejected'
          ? 'features.studio.eventLive.rejected'
          : 'features.studio.eventLive.tie'
    ),
    count: total,
  });
}
export function formatLiveValue(
  binding: LiveBinding,
  source: LiveSource | undefined,
  now: number,
  resultsVisible = true
): string {
  if (!source) return translateText('features.studio.eventLive.unavailable');
  const p = source.payload;
  if (binding.field === 'results') {
    if (!resultsVisible) return translateText('features.studio.eventLive.pendingResult');
    return p.results
      ? resultSummary(p.results)
      : translateText('features.studio.eventLive.noResults');
  }
  if (binding.field === 'details' && p.results)
    return resultsVisible
      ? resultSummary(p.results)
      : translateText('features.studio.eventLive.pendingResult');
  if (binding.field === 'countdown' || binding.format === 'countdown') {
    const target = Number(binding.field === 'countdown' ? p.start_time : p[binding.field]);
    return target > 0
      ? binding.sourceType === 'event' && target <= now
        ? translateText('features.studio.eventLive.startingSoon')
        : countdownText(target, now)
      : '—';
  }
  const time = (value: unknown, date = false) => {
    if (!Number.isFinite(Number(value)) || Number(value) <= 0) return '—';
    try {
      return new Intl.DateTimeFormat('de-DE', {
        timeZone: String(p.timezone || 'Europe/Berlin'),
        ...(date ? { dateStyle: 'medium' as const } : {}),
        timeStyle: 'short',
      }).format(Number(value));
    } catch {
      return '—';
    }
  };
  if (binding.field === 'times')
    return `${time(p.start_time, binding.sourceType === 'event')} – ${time(p.end_time)}`;
  if (binding.format === 'time' || binding.format === 'datetime' || binding.format === 'date')
    return time(p[binding.field], binding.format !== 'time');
  if (binding.field === 'speakers') {
    const speakers = Array.isArray(p.speakers)
      ? (p.speakers as { name: string; time?: number; completed?: boolean }[])
      : [];
    return (
      speakers
        .filter(s => !s.completed)
        .map((s, i) => `${i + 1}. ${s.name}${s.time ? ` · ${s.time} min` : ''}`)
        .join('\n') || translateText('features.studio.eventLive.emptySpeakers')
    );
  }
  if (binding.field === 'current_speaker') {
    const speakers = Array.isArray(p.speakers)
      ? (p.speakers as { name: string; completed?: boolean }[])
      : [];
    return speakers.find(s => !s.completed)?.name || '—';
  }
  const value = p[binding.field];
  return value == null || value === '' ? '—' : typeof value === 'object' ? '—' : String(value);
}
function textNode(node: StudioNode, text: string): StudioNode {
  if (node.type === 'richText') {
    // Preserve styling and IDs. Live resolution must not dirty the editor draft.
    return {
      ...node,
      content: text.split('\n').map((line, i) => ({
        ...node.content[0],
        id: `${node.content[0].id.slice(0, 24)}${i.toString(16).padStart(12, '0')}`,
        children: [
          {
            ...(node.content[0].children[0] as object),
            id: `${node.id.slice(0, 24)}${i.toString(16).padStart(12, '0')}`,
            text: line,
          },
        ],
      })),
    };
  }
  return richTextNodeSchema.parse({
    ...node,
    type: 'richText',
    typography: { fontSize: 42 },
    content: [{ id: node.id, type: 'p', children: [{ id: node.id, text }] }],
  });
}
export function projectLiveDocument(
  document: StudioDocumentV3,
  sources: readonly LiveSource[],
  options: {
    now?: number;
    portrait?: boolean;
    resultsVisible?: boolean;
    page?: number;
    pageSize?: number;
    static?: boolean;
  } = {}
): StudioDocumentV3 {
  const byId = new Map(
    hydrateLiveSources(sources).map(s => [liveSourceKey(s.source_type, s.source_id), s])
  );
  const palette = activePalette(document.theme);
  const now = options.now ?? Date.now();
  const next = structuredClone(document);
  next.nodes = next.nodes.map(node => {
    if (node.type === 'frame') {
      const intro = frameIntro(node);
      if (intro) {
        const source = node.eventSource
          ? byId.get(liveSourceKey(node.eventSource.type, node.eventSource.id))
          : undefined;
        const epoch = Number(source?.payload.start_time);
        node.intro = {
          ...intro,
          epochMs: Number.isFinite(epoch) && epoch > 0 ? epoch : (intro.epochMs ?? 0),
          ...(options.static ? { snapshotAt: now } : {}),
        };
      }
    }
    for (const field of ['fill', 'stroke'] as const) {
      const role = node.style[`${field}Binding`];
      if (role && !node.overrides.includes(`style.${field}`))
        node.style[field] = paletteColor(palette, role);
    }
    const binding = node.liveBinding;
    if (
      binding &&
      node.type === 'richText' &&
      !node.typography.textStyleId &&
      !node.overrides.includes('typography.fontFamily')
    )
      node.typography.fontFamily = themeFontFamily(document.theme.fonts.sans);
    let resolved: StudioNode = node;
    if (binding) {
      const source = byId.get(liveSourceKey(binding.sourceType, binding.sourceId));
      const result = source?.payload.results;
      if (node.type === 'chart' && result && options.resultsVisible !== false) {
        const size = options.pageSize ?? 4;
        const list = result.options.slice(
          ((options.page ?? 0) % Math.max(1, Math.ceil(result.options.length / size))) * size,
          (((options.page ?? 0) % Math.max(1, Math.ceil(result.options.length / size))) + 1) * size
        );
        if (list.length) {
          node.data = {
            kind: 'bar',
            layout: 'results',
            fontFamily: themeFontFamily(document.theme.fonts.sans),
            eligible: result.eligible,
            pageLabel: `${((options.page ?? 0) % Math.max(1, Math.ceil(result.options.length / size))) + 1}/${Math.max(1, Math.ceil(result.options.length / size))}`,
            labels: list.map(o => (o.label.length > 100 ? `${o.label.slice(0, 99)}…` : o.label)),
            legend: true,
            series: [
              {
                id: node.data.series[0].id,
                name: translateText('features.studio.eventLive.indicative'),
                color: paletteColor(palette, 'chart1'),
                values: list.map(o => o.indicative),
              },
              {
                id: node.id,
                name: translateText('features.studio.eventLive.final'),
                color: paletteColor(palette, 'chart2'),
                values: list.map(o => o.final),
              },
            ],
          };
        } else resolved = textNode(node, translateText('features.studio.eventLive.emptyOptions'));
      } else {
        const speakers = source?.payload.speakers;
        const size = options.pageSize ?? 8;
        const list = Array.isArray(speakers) ? speakers.filter(s => !s.completed) : [];
        const start = ((options.page ?? 0) % Math.max(1, Math.ceil(list.length / size))) * size;
        const paged =
          binding.field === 'speakers' && source
            ? {
                ...source,
                payload: { ...source.payload, speakers: list.slice(start, start + size) },
              }
            : source;
        resolved = textNode(node, formatLiveValue(binding, paged, now, options.resultsVisible));
      }
    }
    const fontSizeBefore = resolved.type === 'richText' ? resolved.typography.fontSize : 0;
    if (options.portrait && resolved.portrait) {
      if (resolved.portrait.transform)
        resolved.transform = { ...resolved.transform, ...resolved.portrait.transform };
      if (resolved.portrait.visible !== undefined) resolved.visible = resolved.portrait.visible;
      if (resolved.type === 'richText' && resolved.portrait.fontSize)
        resolved.typography.fontSize = resolved.portrait.fontSize;
      if (resolved.type === 'frame') resolved.preset = 'story';
    }
    if (resolved.type === 'richText') {
      const length = resolved.content
        .map(p => p.children.map(c => ('text' in c ? c.text : '')).join(''))
        .join('').length;
      const capacity = Math.max(
        1,
        ((resolved.transform.width / resolved.typography.fontSize) * resolved.transform.height) /
          (resolved.typography.fontSize * 1.2)
      );
      if (length > capacity)
        resolved.typography.fontSize = Math.max(
          24,
          Math.min(
            resolved.typography.fontSize,
            resolved.typography.fontSize * Math.sqrt(capacity / length)
          )
        );
      const ratio = resolved.typography.fontSize / fontSizeBefore;
      if (ratio !== 1)
        resolved.content = resolved.content.map(block => ({
          ...block,
          children: block.children.map(child =>
            'text' in child && child.fontSize
              ? { ...child, fontSize: child.fontSize * ratio }
              : child
          ),
        }));
    }
    if (options.static) {
      delete resolved.liveBinding;
      delete resolved.showAnimation;
      resolved.animation = 'none';
      if (resolved.type === 'frame') resolved.transition = 'none';
    }
    return resolved;
  });
  if (options.static) {
    next.show = { order: next.show?.order ?? 'agenda', cues: [] };
  }
  return next;
}
