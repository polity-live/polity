// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { StudioFrameTemplates, useStudioFrameTemplateSelection } from '../StudioFrameTemplates';
import { createEventTemplate, eventTemplateTypes } from '../../logic/event-templates';
import { politySourceTypes, type LiveSource } from '../../logic/live-contract';
import type { StudioDocumentV3 } from '../../logic/document-v3';
import type { ComponentProps } from 'react';
import type { Button } from '@/features/shared/ui/ui/button';

const data = vi.hoisted(() => ({
  rows: [] as LiveSource[] | undefined,
  add: undefined as ComponentProps<typeof Button>['onClick'],
}));
vi.mock('@/features/shared/ui/ui/button', async importOriginal => {
  const actual = await importOriginal<typeof import('@/features/shared/ui/ui/button')>();
  return {
    ...actual,
    Button: (props: ComponentProps<typeof Button>) => {
      data.add = props.onClick;
      return <actual.Button {...props} />;
    },
  };
});
vi.mock('@/zero/observed-query', () => ({ useQuery: () => [data.rows] }));
const sourceId = crypto.randomUUID();
beforeEach(() => {
  data.rows = [{ source_type: 'event', source_id: sourceId, payload: { title: 'Live Event' } }];
});

function mountTemplates(disabled = false) {
  let document = createEventTemplate('cover', sourceId);
  const update = vi.fn((edit: (d: StudioDocumentV3) => void) => {
    document = structuredClone(document);
    edit(document);
  });
  function Harness() {
    const selection = useStudioFrameTemplateSelection();
    return <StudioFrameTemplates selection={selection} update={update} disabled={disabled} />;
  }
  const result = render(<Harness />);
  return { update, getDocument: () => document, refresh: () => result.rerender(<Harness />) };
}

function selectEntity(label: string) {
  const input = screen.getByRole('textbox', { name: 'Entity' });
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: label } });
  fireEvent.keyDown(input, { key: 'Enter' });
}

it.each(politySourceTypes)('creates themed templates with the selected %s source', type => {
  data.rows = [{ source_type: type, source_id: sourceId, payload: { title: 'Live Entity' } }];
  const harness = mountTemplates();
  const source = screen.getByRole('combobox', { name: 'Source' });
  fireEvent.change(source, { target: { value: type } });
  expect(screen.getByRole('button', { name: 'Add template' }).matches(':disabled')).toBe(true);
  selectEntity('Live Entity');
  const initialCount = harness.getDocument().nodes.length;
  const theme = harness.getDocument().theme;
  for (const template of eventTemplateTypes) {
    fireEvent.change(screen.getByRole('combobox', { name: 'Event template' }), {
      target: { value: template },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add template' }));
  }
  const added = harness.getDocument().nodes.slice(initialCount);
  expect(added.filter(node => node.type === 'frame')).toHaveLength(eventTemplateTypes.length);
  expect(added.every(node => node.eventTemplateSlot === undefined)).toBe(true);
  expect(added.filter(node => node.type === 'frame').every(node => !node.eventSource)).toBe(true);
  const bindings = added.flatMap(node => (node.liveBinding ? [node.liveBinding] : []));
  expect(bindings.length).toBeGreaterThan(eventTemplateTypes.length);
  expect(
    bindings.every(binding => binding.sourceId === sourceId && binding.sourceType === type)
  ).toBe(true);
  expect(harness.getDocument().theme).toEqual(theme);
  const expected = createEventTemplate('cover', sourceId, 1, theme).nodes[0];
  expect(added[0].style).toEqual(expected.style);
  expect(added[0].transform).toEqual(expected.transform);
});

it('clears removed entities and source changes and rejects stale query rows', () => {
  const harness = mountTemplates();
  expect((screen.getByRole('combobox', { name: 'Source' }) as HTMLSelectElement).value).toBe(
    'event'
  );
  expect(
    (screen.getByRole('combobox', { name: 'Event template' }) as HTMLSelectElement).value
  ).toBe('cover');
  selectEntity('Live Event');
  fireEvent.click(screen.getByRole('button', { name: 'Remove Live Event' }));
  expect(screen.getByRole('button', { name: 'Add template' }).matches(':disabled')).toBe(true);
  selectEntity('Live Event');
  data.rows = [];
  harness.refresh();
  expect(screen.getByRole('button', { name: 'Add template' }).matches(':disabled')).toBe(true);
  data.rows = [{ source_type: 'event', source_id: sourceId, payload: { title: 'Live Event' } }];
  harness.refresh();
  fireEvent.change(screen.getByRole('combobox', { name: 'Source' }), {
    target: { value: 'group' },
  });
  expect(screen.queryByText('Live Event')).toBeNull();
  expect(screen.getByRole('button', { name: 'Add template' }).matches(':disabled')).toBe(true);
  expect(harness.update).not.toHaveBeenCalled();
});

it('disables template edits for read-only documents', () => {
  const harness = mountTemplates(true);
  for (const name of ['Source', 'Event template'])
    expect(screen.getByRole('combobox', { name }).matches(':disabled')).toBe(true);
  expect(screen.getByRole('textbox', { name: 'Entity' }).matches(':disabled')).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Add template' }));
  expect(screen.getByRole('button', { name: 'Add template' }).matches(':disabled')).toBe(true);
  data.add!({} as Parameters<NonNullable<typeof data.add>>[0]);
  expect(harness.update).not.toHaveBeenCalled();
});

it.each([{ name: 'Named group' }, { first_name: 'Ada', last_name: 'Lovelace' }, {}])(
  'finds a source using its available identity fields %j',
  payload => {
    data.rows = [{ source_type: 'event', source_id: sourceId, payload }];
    const harness = mountTemplates();
    const label =
      'name' in payload ? payload.name : 'first_name' in payload ? 'Ada Lovelace' : sourceId;
    selectEntity(label!);
    fireEvent.click(screen.getByRole('button', { name: 'Add template' }));
    expect(harness.update).toHaveBeenCalledOnce();
    expect(harness.getDocument().nodes.some(node => node.liveBinding?.sourceId === sourceId)).toBe(
      true
    );
  }
);

it('treats an unresolved source query as empty and defends insertion callbacks without a valid selection', () => {
  data.rows = undefined;
  const harness = mountTemplates();
  expect(screen.getByRole('button', { name: 'Add template' }).matches(':disabled')).toBe(true);
  data.add!({} as Parameters<NonNullable<typeof data.add>>[0]);
  expect(harness.update).not.toHaveBeenCalled();
});

it('isolates control keys from toolbar navigation while permitting Escape to dismiss the panel', () => {
  mountTemplates();
  const listener = vi.fn();
  window.addEventListener('keydown', listener);
  try {
    const fieldset = globalThis.document.querySelector(
      '[data-action-id="studio.template.keyboard"]'
    )!;
    fireEvent.keyDown(fieldset, { key: 'ArrowDown' });
    expect(listener).not.toHaveBeenCalled();
    fireEvent.keyDown(fieldset, { key: 'Escape' });
    expect(listener).toHaveBeenCalledOnce();
  } finally {
    window.removeEventListener('keydown', listener);
  }
});
