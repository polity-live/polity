import { translate } from '@/features/shared/hooks/use-translation';
import { describe, expect, it } from 'vitest';
import { createEventTemplate, eventTemplateTypes } from '../event-templates';
import { studioDocumentV3Schema } from '../document-v3';
import {
  countdownText,
  projectLiveDocument,
  resultSummary,
  hydrateLiveSources,
} from '../live-projection';
import { createLiveSnapshot } from '../live-snapshot';
import type { LiveSource, LiveResult } from '../live-contract';

const id = crypto.randomUUID();
const result: LiveResult = {
  title: 'Beschluss',
  status: 'closed',
  eligible: 20,
  majority_type: 'absolute',
  options: [
    { id: crypto.randomUUID(), label: 'Ja', indicative: 12, final: 11 },
    { id: crypto.randomUUID(), label: 'Nein', indicative: 8, final: 9 },
  ],
};
const source: LiveSource = {
  source_type: 'agenda_item',
  source_id: id,
  payload: {
    title: 'Neuer Titel',
    start_time: 1800000000000,
    end_time: 1800001800000,
    timezone: 'Europe/Berlin',
    results: result,
  },
};
describe('Event Studio live projection', () => {
  it('keeps private result data unavailable while resolving readable result references', () => {
    const voteId = crypto.randomUUID();
    const agenda = {
      ...source,
      payload: { title: 'Public agenda', result_source_type: 'vote', result_source_id: voteId },
    };
    expect(hydrateLiveSources([agenda])[0].payload.results).toBeNull();
    expect(
      hydrateLiveSources([
        agenda,
        { source_type: 'vote', source_id: voteId, payload: { results: result } },
      ])[0].payload.results
    ).toEqual(result);
  });
  it.each(eventTemplateTypes)(
    'creates a valid %s template with source bindings and both layouts',
    type => {
      const d = createEventTemplate(type, id);
      expect(studioDocumentV3Schema.safeParse(d).success).toBe(true);
      expect(d.nodes.find(n => n.type === 'frame')?.eventSource?.id).toBe(id);
      const portrait = projectLiveDocument(d, [source], { portrait: true });
      expect(portrait.nodes.find(n => n.type === 'frame')?.transform).toMatchObject({
        width: 1080,
        height: 1920,
      });
    }
  );
  it('updates content and chart counts without modifying the editable design', () => {
    const d = createEventTemplate('vote', id);
    const before = structuredClone(d);
    const p = projectLiveDocument(d, [source]);
    expect(d).toEqual(before);
    const title = p.nodes.find(n => n.liveBinding?.field === 'title');
    expect(title?.type === 'richText' && title.content[0].children[0]).toMatchObject({
      text: 'Neuer Titel',
    });
    const chart = p.nodes.find(n => n.type === 'chart');
    expect(chart?.type === 'chart' && chart.data.series[1].values).toEqual([11, 9]);
    const hidden = projectLiveDocument(d, [source], { resultsVisible: false });
    expect(hidden.nodes.some(n => n.type === 'chart')).toBe(false);
  });
  it('uses the agenda majority and election tie semantics', () => {
    expect(resultSummary(result)).toContain(translate('features.studio.eventLive.passed'));
    expect(resultSummary({ ...result, eligible: 30 })).toContain(
      translate('features.studio.eventLive.rejected')
    );
    expect(
      resultSummary({
        ...result,
        election_mode: 'single',
        options: result.options.map(o => ({ ...o, final: 10 })),
      })
    ).toContain(translate('features.studio.eventLive.tie'));
    expect(resultSummary({ ...result, election_mode: 'list', seat_count: 2 })).toContain(
      'Ja, Nein'
    );
    expect(countdownText(61000, 0)).toBe('00:01:01');
    expect(countdownText(0, 1000)).toBe('00:00:00');
  });
  it('captures every overflow page and freezes data, bindings, animations and music', () => {
    const d = createEventTemplate('election', id);
    const s = structuredClone(source);
    s.payload.results!.options = Array.from({ length: 105 }, (_, i) => ({
      id: crypto.randomUUID(),
      label: `Kandidat ${i}`,
      indicative: i,
      final: i + 1,
    }));
    const frame = d.nodes.find(n => n.type === 'frame')!;
    const captured = createLiveSnapshot(d, [s], { now: 1000, portrait: true });
    expect(captured.frameIds([frame.id])).toHaveLength(27);
    const charts = captured.document.nodes.filter(n => n.type === 'chart');
    expect(charts.flatMap(n => n.data.labels)).toHaveLength(105);
    expect(charts.at(-1)?.data.labels.at(-1)).toBe('Kandidat 104');
    expect(captured.document.nodes.every(n => !n.liveBinding && !n.showAnimation)).toBe(true);
    expect(studioDocumentV3Schema.safeParse(captured.document).success).toBe(true);
    s.payload.results!.options[0].final = 999;
    expect(charts[0].data.series[1].values[0]).toBe(1);
  });
  it('handles missing sources and invalid timezones without corrupting the document', () => {
    const d = createEventTemplate('discussion', id);
    const p = projectLiveDocument(d, []);
    expect(studioDocumentV3Schema.safeParse(p).success).toBe(true);
    expect(() =>
      projectLiveDocument(d, [
        { ...source, payload: { ...source.payload, timezone: 'invalid/timezone' } },
      ])
    ).not.toThrow();
  });
});
