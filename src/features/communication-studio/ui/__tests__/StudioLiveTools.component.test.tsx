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
const data = vi.hoisted(() => ({ rows: [] as any[] | undefined }));
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
      sources={data.rows ?? []}
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
    sources: data.rows ?? [],
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
    sources: data.rows ?? [],
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

it.each([
  ['results', 'results'],
  ['speakers', 'speakers'],
  ['countdown', 'countdown'],
  ['start_time', 'datetime'],
  ['title', 'text'],
] as const)('inserts a %s variable with its matching display format', (field, format) => {
  const harness = mountTools();
  openPanel('polity-data');
  selectEntity('Live Event');
  fireEvent.change(screen.getByRole('combobox', { name: 'Value' }), { target: { value: field } });
  fireEvent.click(screen.getByRole('button', { name: 'Insert variable' }));
  expect(harness.getDocument().nodes.at(-1)?.liveBinding).toMatchObject({
    field,
    format,
    sourceId: event,
  });
});

it('links an agenda-bound node to its parent event and refuses zero portrait dimensions', () => {
  const document = createEventTemplate('discussion', event);
  const title = document.nodes.find(node => node.liveBinding?.field === 'title')!;
  const update = vi.fn();
  render(
    <Tools
      document={document}
      frameId={document.nodes[0].id}
      selectedId={title.id}
      sources={[
        {
          source_type: 'agenda_item',
          source_id: event,
          event_id: asset,
          payload: { title: 'Discussion' },
        },
      ]}
      assets={[]}
      update={update}
      portrait
      setPortrait={vi.fn()}
    />
  );
  openPanel('polity-data');
  expect(screen.getByRole('link').getAttribute('href')).toBe(`/event/${asset}/agenda`);
  openPanel('responsive-layout');
  expect(
    (screen.getByRole('combobox', { name: 'Layout preview' }) as HTMLSelectElement).value
  ).toBe('portrait');
  for (const label of ['Portrait width', 'Portrait height'])
    fireEvent.change(screen.getByRole('spinbutton', { name: label }), { target: { value: '0' } });
  expect(update).not.toHaveBeenCalled();
});

it('shows the wide geometry until a selected node has its first portrait override', () => {
  const harness = mountTools();
  const node = harness.getDocument().nodes.find(node => node.id === harness.selectedId)!;
  delete node.portrait;
  harness.refresh();
  openPanel('responsive-layout');
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    expect(
      (screen.getByRole('spinbutton', { name: `Portrait ${key}` }) as HTMLInputElement)
        .valueAsNumber
    ).toBe(node.transform[key]);
  }
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Portrait x' }), {
    target: { value: '42' },
  });
  expect(
    harness.getDocument().nodes.find(node => node.id === harness.selectedId)!.portrait?.transform?.x
  ).toBe(42);
});

it('keeps an unresolved entity query empty and lets unnamed sources be selected by their stable ID', () => {
  data.rows = undefined;
  const harness = mountTools();
  openPanel('polity-data');
  expect(screen.getByRole('button', { name: 'Insert variable' }).matches(':disabled')).toBe(true);
  data.rows = [{ source_type: 'event', source_id: event, payload: {} }];
  harness.refresh();
  selectEntity(event);
  fireEvent.click(screen.getByRole('button', { name: 'Insert variable' }));
  expect(harness.getDocument().nodes.at(-1)?.liveBinding?.sourceId).toBe(event);
});

it('ignores live-binding and portrait edits when a collaborator removes the selected node before the transaction', () => {
  const document = createEventTemplate('cover', event);
  const title = document.nodes.find(node => node.liveBinding?.field === 'title')!;
  const changed: StudioDocumentV3[] = [];
  const update = vi.fn((edit: (draft: StudioDocumentV3) => void) => {
    const draft = structuredClone(document);
    draft.nodes = draft.nodes.filter(node => node.id !== title.id);
    edit(draft);
    changed.push(draft);
  });
  render(
    <Tools
      document={document}
      frameId={document.nodes[0].id}
      selectedId={title.id}
      sources={data.rows ?? []}
      assets={[]}
      update={update}
      portrait={false}
      setPortrait={vi.fn()}
    />
  );
  openPanel('polity-data');
  selectEntity('Live Event');
  fireEvent.click(screen.getByRole('button', { name: 'Bind selection' }));
  fireEvent.click(screen.getByRole('button', { name: 'Convert to static content' }));
  openPanel('responsive-layout');
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Portrait x' }), {
    target: { value: '12' },
  });
  expect(changed).toHaveLength(3);
  expect(changed.every(draft => draft.nodes.every(node => node.id !== title.id))).toBe(true);
  const count = update.mock.calls.length;
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Portrait width' }), {
    target: { value: '' },
  });
  expect(update).toHaveBeenCalledTimes(count);
});
