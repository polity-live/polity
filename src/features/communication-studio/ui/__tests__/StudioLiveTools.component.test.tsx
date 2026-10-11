// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { Toolbar } from '@/features/shared/ui/layout';
import { openStudioPanel } from '../../logic/panel-events';
import { politySourceTypes } from '../../logic/live-contract';
import { StudioLiveTools } from '../StudioLiveTools';
import { createEventTemplate } from '../../logic/event-templates';
import type { StudioDocumentV3 } from '../../logic/document-v3';
function Tools(props: ComponentProps<typeof StudioLiveTools>) {
  return (
    <Toolbar>
      <StudioLiveTools {...props} />
    </Toolbar>
  );
}
function openPanel(key: 'polity-data' | 'responsive-layout' | 'music-animation') {
  fireEvent.keyDown(globalThis.document, { key: 'Escape' });
  act(() => openStudioPanel(key));
}
function selectEntity(query: string) {
  const input = screen.getByRole('textbox', { name: 'Entity' });
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: query } });
  fireEvent.keyDown(input, { key: 'Enter' });
}
const data = vi.hoisted(() => ({ rows: [] as any[] }));
vi.mock('../KonvaStudioCanvas', () => ({
  default: () => <div data-testid="intro-preview" />,
}));
vi.mock('@/zero/observed-query', () => ({ useQuery: () => [data.rows] }));
const event = crypto.randomUUID(),
  asset = crypto.randomUUID();
beforeEach(() => {
  data.rows = [{ source_type: 'event', source_id: event, payload: { title: 'Live Event' } }];
});

it('opens visualization insertion from the toolbar and closes the current panel', () => {
  const document = createEventTemplate('cover', event);
  const onInsertData = vi.fn();
  render(
    <Tools
      document={document}
      frameId={document.nodes[0].id}
      sources={data.rows}
      assets={[]}
      update={vi.fn()}
      portrait={false}
      setPortrait={vi.fn()}
      onInsertData={onInsertData}
    />
  );
  const trigger = screen.getByRole('button', { name: 'Insert data visualization' });
  openPanel('polity-data');
  expect(screen.getByRole('textbox', { name: 'Entity' })).toBeTruthy();
  fireEvent.click(trigger);
  expect(onInsertData).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('textbox', { name: 'Entity' })).toBeNull();
});

function mountTools(disabled = false) {
  let document = createEventTemplate('cover', event);
  const title = document.nodes.find(n => n.liveBinding?.field === 'title')!;
  const props = () => ({
    document,
    frameId: document.nodes[0].id,
    selectedId: title.id,
    sources: data.rows,
    assets: [{ id: asset, name: 'Intro', mime: 'audio/mpeg' }],
    update: (edit: (d: StudioDocumentV3) => void) => {
      document = structuredClone(document);
      edit(document);
    },
    portrait: false,
    setPortrait: vi.fn(),
    disabled,
  });
  const result = render(<Tools {...props()} />);
  return {
    getDocument: () => document,
    selectedId: title.id,
    refresh: () => result.rerender(<Tools {...props()} />),
  };
}

it('offers three icon panels with only their assigned controls', () => {
  mountTools();
  for (const label of [/Polity data/i, 'Responsive Layout', 'Music & Animation']) {
    const trigger = screen.getByRole('button', { name: label });
    expect(trigger.querySelector('svg')).toBeTruthy();
    expect(trigger.textContent?.trim()).toBe('');
  }
  openPanel('polity-data');
  expect(screen.getByRole('combobox', { name: 'Source' })).toBeTruthy();
  expect(screen.queryByRole('combobox', { name: 'Event template' })).toBeNull();
  expect(screen.queryByRole('combobox', { name: 'Layout preview' })).toBeNull();
  expect(screen.queryByRole('combobox', { name: 'Audio file' })).toBeNull();
  openPanel('responsive-layout');
  expect(screen.getByRole('combobox', { name: 'Layout preview' })).toBeTruthy();
  expect(screen.queryByRole('combobox', { name: 'Source' })).toBeNull();
  expect(screen.queryByRole('combobox', { name: 'Intro background' })).toBeNull();
  openPanel('music-animation');
  expect(screen.getByRole('region', { name: 'Animations' })).toBeTruthy();
  expect(screen.getByRole('tree', { name: 'Slides, music and animations' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Add music' })).toBeTruthy();
  expect(screen.queryByRole('combobox', { name: 'Source' })).toBeNull();
  expect(screen.queryByRole('combobox', { name: 'Layout preview' })).toBeNull();
});

it.each(politySourceTypes)('searches %s entities and stores IDs in bindings', type => {
  const ids = Array.from({ length: 25 }, () => crypto.randomUUID());
  data.rows = ids.map((id, index) => ({
    source_type: type,
    source_id: id,
    payload:
      type === 'user'
        ? { first_name: 'Person', last_name: `${index + 1}` }
        : type === 'group'
          ? { name: `Group ${index + 1}` }
          : { title: `Entity ${index + 1}` },
  }));
  const harness = mountTools();
  openPanel('polity-data');
  fireEvent.change(screen.getByRole('combobox', { name: 'Source' }), { target: { value: type } });
  for (const name of ['Insert variable', 'Bind selection']) {
    expect(screen.getByRole('button', { name }).matches(':disabled')).toBe(true);
  }
  const label = `${type === 'user' ? 'Person' : type === 'group' ? 'Group' : 'Entity'} 25`;
  selectEntity(label);
  fireEvent.click(screen.getByRole('button', { name: 'Insert variable' }));
  expect(harness.getDocument().nodes.at(-1)?.liveBinding).toMatchObject({
    sourceType: type,
    sourceId: ids[24],
  });
  fireEvent.click(screen.getByRole('button', { name: 'Bind selection' }));
  expect(
    harness.getDocument().nodes.find(n => n.id === harness.selectedId)?.liveBinding
  ).toMatchObject({
    sourceType: type,
    sourceId: ids[24],
  });
});

it('clears explicit selections, resets on source changes and rejects stale query rows', () => {
  const harness = mountTools();
  openPanel('polity-data');
  selectEntity('Live Event');
  fireEvent.click(screen.getByRole('button', { name: 'Remove Live Event' }));
  expect(screen.getByRole('button', { name: 'Insert variable' }).matches(':disabled')).toBe(true);
  selectEntity('Live Event');
  fireEvent.change(screen.getByRole('combobox', { name: 'Source' }), {
    target: { value: 'amendment' },
  });
  expect(screen.queryByText('Live Event')).toBeNull();
  expect(screen.getByRole('button', { name: 'Bind selection' }).matches(':disabled')).toBe(true);
  const input = screen.getByRole('textbox', { name: 'Entity' });
  fireEvent.change(input, { target: { value: 'Missing item' } });
  expect(screen.getByText('No results found')).toBeTruthy();
  data.rows = [];
  harness.refresh();
  expect(screen.getByRole('button', { name: 'Insert variable' }).matches(':disabled')).toBe(true);
});

it('disables entity searching and editing in read-only documents', () => {
  mountTools(true);
  openPanel('polity-data');
  const input = screen.getByRole('textbox', { name: 'Entity' });
  expect(input.matches(':disabled')).toBe(true);
  fireEvent.change(input, { target: { value: 'Live Event' } });
  expect(screen.queryByText('Live Event')).toBeNull();
  for (const name of ['Insert variable', 'Bind selection']) {
    expect(screen.getByRole('button', { name }).matches(':disabled')).toBe(true);
  }
  openPanel('responsive-layout');
  expect(screen.getByRole('spinbutton', { name: 'Portrait width' }).matches(':disabled')).toBe(
    true
  );
  openPanel('music-animation');
  expect(screen.getByRole('button', { name: 'Add music' }).matches(':disabled')).toBe(true);
  expect(screen.getByRole('button', { name: 'Add transition sound' }).matches(':disabled')).toBe(
    true
  );
});
it('inserts and detaches entity variables, edits portrait layouts and manages presentation cues', () => {
  let document = createEventTemplate('cover', event);
  const frame = document.nodes.find(n => n.type === 'frame')!;
  const title = document.nodes.find(n => n.liveBinding?.field === 'title')!;
  const portrait = vi.fn();
  const props = () => ({
    document,
    frameId: frame.id,
    selectedId: title.id,
    sources: data.rows,
    assets: [{ id: asset, name: 'Intro', mime: 'audio/mpeg' }],
    update: (edit: (d: StudioDocumentV3) => void) => {
      document = structuredClone(document);
      edit(document);
    },
    portrait: false,
    setPortrait: portrait,
  });
  const r = render(<Tools {...props()} />);
  const click = (id: string) => {
    const button = globalThis.document.querySelector(`[data-action-id="${id}"]`)!;
    (button as HTMLElement).focus();
    fireEvent.click(button);
    r.rerender(<Tools {...props()} />);
  };
  openPanel('polity-data');
  selectEntity('Live Event');
  click('studio.live.insert');
  expect(document.nodes.at(-1)?.liveBinding).toMatchObject({ sourceId: event, field: 'title' });
  click('studio.live.bind');
  expect(document.nodes.find(n => n.id === title.id)?.liveBinding?.sourceId).toBe(event);
  expect(screen.getByRole('link').getAttribute('href')).toBe(`/event/${event}`);
  click('studio.live.detach');
  const detached = document.nodes.find(n => n.id === title.id)!;
  expect(detached.liveBinding).toBeUndefined();
  expect(detached.type === 'richText' && detached.content[0].children[0]).toMatchObject({
    text: 'Live Event',
  });
  openPanel('responsive-layout');
  fireEvent.change(screen.getByRole('combobox', { name: 'Layout preview' }), {
    target: { value: 'portrait' },
  });
  expect(portrait).toHaveBeenCalledWith(true);
  const width = screen.getByRole('spinbutton', { name: 'Portrait width' });
  fireEvent.change(width, { target: { value: '800' } });
  r.rerender(<Tools {...props()} />);
  expect(document.nodes.find(n => n.id === title.id)?.portrait?.transform?.width).toBe(800);
});
it('requires a source to save music while offering integrated music without uploads', () => {
  data.rows = [];
  const document = createEventTemplate('cover', event);
  render(
    <Tools
      document={document}
      frameId={document.nodes[0].id}
      sources={[]}
      assets={[]}
      update={vi.fn()}
      portrait={false}
      setPortrait={vi.fn()}
    />
  );
  openPanel('polity-data');
  for (const id of ['studio.live.insert'])
    expect(
      (globalThis.document.querySelector(`[data-action-id="${id}"]`) as HTMLButtonElement).disabled
    ).toBe(true);
  openPanel('music-animation');
  fireEvent.click(screen.getByRole('button', { name: 'Add music' }));
  expect(screen.getByRole('button', { name: 'Save' }).matches(':disabled')).toBe(true);
});
