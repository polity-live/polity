import { describe, expect, it } from 'vitest';
import { translate } from '@/features/shared/hooks/use-translation';
import { createBoundText, createEventTemplate, createLiveNode } from '../event-templates';
import { createFrameNode, studioDocumentV3Schema, type FrameNode } from '../document-v3';
import type { LiveBinding, LiveResult, LiveSource } from '../live-contract';
import {
  countdownText,
  formatLiveValue,
  projectLiveDocument,
  resultSourceRefs,
  resultSummary,
} from '../live-projection';
import { createLiveSnapshot } from '../live-snapshot';

const id = crypto.randomUUID();
const binding = (
  field: LiveBinding['field'],
  format: LiveBinding['format'] = 'text'
): LiveBinding => ({ sourceType: 'agenda_item', sourceId: id, field, format });
const source = (payload: LiveSource['payload']): LiveSource => ({
  source_type: 'agenda_item',
  source_id: id,
  payload,
});
const result: LiveResult = {
  title: 'Decision',
  status: 'closed',
  eligible: 20,
  options: [
    { id: crypto.randomUUID(), label: 'Yes', indicative: 12, final: 11 },
    { id: crypto.randomUUID(), label: 'No', indicative: 8, final: 9 },
  ],
};
const text = (document: ReturnType<typeof projectLiveDocument>) =>
  document.nodes
    .filter(n => n.type === 'richText')
    .flatMap(n => n.content.flatMap(p => p.children.flatMap(c => ('text' in c ? [c.text] : []))))
    .join('\n');

describe('live presentation edge cases', () => {
  it('deduplicates valid result references and ignores unrelated or malformed references', () => {
    expect(
      resultSourceRefs([
        source({ result_source_type: 'vote', result_source_id: id }),
        source({ result_source_type: 'vote', result_source_id: id }),
        source({ result_source_type: 'election', result_source_id: id }),
        source({ result_source_type: 'event', result_source_id: id }),
        source({ result_source_type: 'vote', result_source_id: 3 }),
      ])
    ).toEqual([
      { type: 'vote', id },
      { type: 'election', id },
    ]);
  });

  it('distinguishes indicative totals, terminal election states, tied winners and empty ballots', () => {
    expect(resultSummary({ ...result, status: 'indicative' })).toContain('20');
    expect(resultSummary({ ...result, status: 'active' })).toContain('20');
    expect(resultSummary({ ...result, election_mode: 'single', status: 'no_winner' })).toContain(
      translate('features.studio.eventLive.noWinner')
    );
    expect(
      resultSummary({ ...result, election_mode: 'single', status: 'runoff_required' })
    ).toContain(translate('features.studio.eventLive.runoff'));
    expect(
      resultSummary({
        ...result,
        election_mode: 'single',
        options: result.options.map(o => ({ ...o, final: 0 })),
      })
    ).toContain(translate('features.studio.eventLive.noWinner'));
    expect(
      resultSummary({
        ...result,
        election_mode: 'list',
        seat_count: 1,
        options: result.options.map(o => ({ ...o, final: 10 })),
      })
    ).toContain(translate('features.studio.eventLive.runoff'));
    expect(resultSummary({ ...result, majority_type: 'two_thirds' })).toContain(
      translate('features.studio.eventLive.rejected')
    );
    expect(
      resultSummary({
        ...result,
        majority_type: 'simple',
        options: result.options.map(o => ({ ...o, final: 10 })),
      })
    ).toContain(translate('features.studio.eventLive.tie'));
    expect(countdownText(86_461_000, 0)).toContain('00:01:01');
  });

  it('renders available, pending and absent results without exposing hidden result data', () => {
    expect(formatLiveValue(binding('results'), source({ results: result }), 0)).toEqual(
      resultSummary(result)
    );
    expect(formatLiveValue(binding('results'), source({}), 0)).toBe(
      translate('features.studio.eventLive.noResults')
    );
    expect(formatLiveValue(binding('results'), source({ results: result }), 0, false)).toBe(
      translate('features.studio.eventLive.pendingResult')
    );
    expect(formatLiveValue(binding('details'), source({ results: result }), 0)).toEqual(
      resultSummary(result)
    );
    expect(formatLiveValue(binding('details'), source({ results: result }), 0, false)).toBe(
      translate('features.studio.eventLive.pendingResult')
    );
  });

  it.each(['time', 'date', 'datetime'] as const)(
    'formats %s and rejects invalid dates and timezones',
    format => {
      const formatted = formatLiveValue(
        binding('start_time', format),
        source({ start_time: 1_893_456_000_000 }),
        0
      );
      expect(formatted).toContain('01:00');
      if (format !== 'time') expect(formatted).toContain('01.01.2030');
      expect(formatLiveValue(binding('start_time', format), source({ start_time: -1 }), 0)).toBe(
        '—'
      );
      expect(
        formatLiveValue(binding('start_time', format), source({ start_time: 'invalid' }), 0)
      ).toBe('—');
      expect(
        formatLiveValue(
          binding('start_time', format),
          source({ start_time: 1_893_456_000_000, timezone: 'invalid' }),
          0
        )
      ).toBe('—');
    }
  );

  it('handles countdown values, completed speakers and unsupported display values', () => {
    expect(
      formatLiveValue(binding('start_time', 'countdown'), source({ start_time: 61_000 }), 0)
    ).toBe('00:01:01');
    expect(formatLiveValue(binding('countdown'), source({ start_time: 0 }), 0)).toBe('—');
    const eventBinding = { ...binding('countdown'), sourceType: 'event' as const };
    expect(formatLiveValue(eventBinding, source({ start_time: 1000 }), 1000)).toBe(
      translate('features.studio.eventLive.startingSoon')
    );
    const speakers = [
      { name: 'Finished', completed: true },
      { name: 'Alice', time: 3 },
      { name: 'Bob' },
    ];
    expect(formatLiveValue(binding('speakers'), source({ speakers }), 0)).toBe(
      '1. Alice · 3 min\n2. Bob'
    );
    expect(formatLiveValue(binding('current_speaker'), source({ speakers }), 0)).toBe('Alice');
    expect(
      formatLiveValue(
        binding('current_speaker'),
        source({ speakers: [{ name: 'Finished', completed: true }] }),
        0
      )
    ).toBe('—');
    expect(formatLiveValue(binding('current_speaker'), source({ speakers: 'invalid' }), 0)).toBe(
      '—'
    );
    expect(formatLiveValue(binding('speakers'), source({ speakers: 'invalid' }), 0)).toBe(
      translate('features.studio.eventLive.emptySpeakers')
    );
    for (const value of [null, '', { private: 'value' }])
      expect(formatLiveValue(binding('title'), source({ title: value }), 0)).toBe('—');
    expect(formatLiveValue(binding('duration'), source({ duration: 15 }), 0)).toBe('15');
  });

  it('replaces empty charts with explanatory text and truncates long chart labels', () => {
    const document = createEventTemplate('vote', id);
    const chart = document.nodes.find(n => n.type === 'chart')!;
    expect(
      text(projectLiveDocument(document, [source({ results: { ...result, options: [] } })]))
    ).toContain(translate('features.studio.eventLive.emptyOptions'));
    const projected = projectLiveDocument(document, [
      source({
        results: { ...result, options: [{ ...result.options[0], label: 'A'.repeat(101) }] },
      }),
    ]);
    const projectedChart = projected.nodes.find(n => n.id === chart.id);
    expect(projectedChart?.type === 'chart' && projectedChart.data.labels).toEqual([
      'A'.repeat(99) + '…',
    ]);
    expect(createLiveNode(binding('results'), crypto.randomUUID()).type).toBe('chart');
    expect(createLiveNode(binding('title'), crypto.randomUUID()).type).toBe('richText');
  });

  it('paginates active speakers, freezes snapshots and preserves the source document', () => {
    const document = createEventTemplate('discussion', id);
    const frame = document.nodes.find(n => n.type === 'frame')!;
    const speakers = [
      { name: 'Finished', completed: true },
      ...Array.from({ length: 9 }, (_, i) => ({ name: `Speaker ${i}` })),
    ];
    const before = structuredClone(document);
    const projected = projectLiveDocument(document, [source({ speakers })], {
      page: 1,
      pageSize: 4,
    });
    expect(text(projected)).toContain('Speaker 4');
    expect(text(projected)).not.toContain('Finished');
    const snapshot = createLiveSnapshot(document, [source({ speakers })], { now: 1000 });
    expect(snapshot.frameIds([frame.id, id])).toHaveLength(4);
    expect(text(snapshot.document)).toContain('Speaker 8');
    expect(snapshot.document.nodes.every(n => !n.liveBinding)).toBe(true);
    expect(document).toEqual(before);
    expect(studioDocumentV3Schema.safeParse(snapshot.document).success).toBe(true);
    expect(
      createLiveSnapshot(createEventTemplate('vote', id), [], {
        now: 0,
        resultsVisible: false,
      }).document.nodes.filter(n => n.type === 'frame')
    ).toHaveLength(1);
  });

  it('applies portrait visibility and rescales styled text without altering inline elements', () => {
    const document = createEventTemplate('cover', id);
    const frame = document.nodes.find(n => n.type === 'frame')!;
    delete frame.eventSource;
    const node = createBoundText(binding('title'), frame.id);
    if (node.type !== 'richText') throw new Error('Expected text');
    delete node.liveBinding;
    node.portrait = { visible: false };
    node.transform.width = 10;
    node.transform.height = 10;
    node.content[0].children = [
      { id: crypto.randomUUID(), text: 'Long content'.repeat(100), fontSize: 42 },
      {
        id: crypto.randomUUID(),
        type: 'link',
        children: [{ id: crypto.randomUUID(), text: 'link' }],
      },
    ];
    document.nodes.push(node, createFrameNode('widescreen'));
    const projected = projectLiveDocument(document, [], { portrait: true, static: true, now: 0 });
    const resized = projected.nodes.find(n => n.id === node.id)!;
    expect(resized.visible).toBe(false);
    expect(resized.type === 'richText' && resized.typography.fontSize).toBe(24);
    expect(resized.type === 'richText' && resized.content[0].children[0]).toMatchObject({
      fontSize: 24,
    });
    expect(resized.type === 'richText' && resized.content[0].children[1]).toEqual(
      node.content[0].children[1]
    );
    expect(
      projected.nodes.find((n): n is FrameNode => n.id === frame.id && n.type === 'frame')?.intro
        ?.snapshotAt
    ).toBe(0);
    expect(document.nodes.find(n => n.id === node.id)?.visible).toBe(true);
  });

  it('resolves fonts and intro epochs for legacy documents without show settings', () => {
    const document = createEventTemplate('cover', id);
    delete document.show;
    const frame = document.nodes.find(n => n.type === 'frame')!;
    if (!frame.intro) throw new Error('Expected intro');
    delete frame.intro.epochMs;
    const node = createBoundText({ ...binding('title'), sourceType: 'event' }, frame.id);
    if (node.type !== 'richText') throw new Error('Expected text');
    document.nodes.push(node);
    const liveSource: LiveSource = {
      source_type: 'event',
      source_id: id,
      payload: { title: 'Event', start_time: 1000 },
    };
    const projected = projectLiveDocument(document, [liveSource], { static: true, now: 2000 });
    expect(
      projected.nodes.find((n): n is FrameNode => n.id === frame.id && n.type === 'frame')?.intro
        ?.epochMs
    ).toBe(1000);
    expect(projected.show).toEqual({ order: 'agenda', cues: [] });
    expect(
      projected.nodes.find(n => n.id === node.id)?.type === 'richText' &&
        (projected.nodes.find(n => n.id === node.id) as typeof node).typography.fontFamily
    ).toBeTruthy();
    expect(
      projectLiveDocument(document, [], { now: 2000 }).nodes.find(
        (n): n is FrameNode => n.id === frame.id && n.type === 'frame'
      )?.intro?.epochMs
    ).toBe(0);
    node.overrides.push('typography.fontFamily');
    node.typography.fontFamily = 'Newsreader';
    expect(
      (projectLiveDocument(document, [liveSource]).nodes.find(n => n.id === node.id) as typeof node)
        .typography.fontFamily
    ).toBe('Newsreader');
    expect(
      createLiveSnapshot(createEventTemplate('vote', id), [], { now: 0 }).document.nodes.filter(
        n => n.type === 'frame'
      )
    ).toHaveLength(1);
  });

  it('remaps nested overflow frames and keeps unrelated external parents outside the copied subtree', () => {
    const document = createEventTemplate('discussion', id);
    const frame = document.nodes.find(n => n.type === 'frame')!;
    const nested = createFrameNode('widescreen', { parentFrameId: frame.id });
    const node = createBoundText(binding('title'), nested.id);
    const externalFrame = createFrameNode('widescreen');
    const external = createBoundText(binding('title'), externalFrame.id);
    document.nodes.push(nested, node, externalFrame, external);
    const snapshot = createLiveSnapshot(
      document,
      [source({ speakers: Array.from({ length: 5 }, (_, i) => ({ name: `Speaker ${i}` })) })],
      { now: 0 }
    );
    const pageIds = snapshot.frameIds([frame.id]);
    expect(pageIds).toHaveLength(2);
    const copiedNested = snapshot.document.nodes.find(
      n => n.type === 'frame' && n.parentFrameId === pageIds[1]
    );
    expect(copiedNested).toBeDefined();
    expect(
      snapshot.document.nodes.some(
        n => n.parentFrameId === copiedNested!.id && n.name === node.name
      )
    ).toBe(true);
    expect(snapshot.document.nodes.filter(n => n.id === external.id)).toHaveLength(1);
    expect(snapshot.document.nodes.find(n => n.id === external.id)?.parentFrameId).toBe(
      external.parentFrameId
    );
    expect(new Set(snapshot.document.nodes.map(n => n.id)).size).toBe(
      snapshot.document.nodes.length
    );
    expect(() => studioDocumentV3Schema.parse(snapshot.document)).not.toThrow();
  });
});
