/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ combo: undefined as any, editor: undefined as any }));
vi.mock('../PqlComboboxView', () => ({
  PqlComboboxView: (props: any) => {
    state.combo = props;
    return null;
  },
}));
vi.mock('../PqlQueryEditorView', () => ({
  PqlQueryEditorView: (props: any) => {
    state.editor = props;
    return null;
  },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));

import { PqlCombobox } from '../PqlCombobox';
import { PqlFilterBuilderDialogView } from '../PqlFilterBuilderDialogView';
import { PqlQueryEditor } from '../PqlQueryEditor';

afterEach(cleanup);

it('forwards default and explicit combobox flags', () => {
  const view = render(
    <PqlCombobox
      options={[]}
      onValueChange={vi.fn()}
      placeholder="p"
      searchPlaceholder="s"
      emptyText="e"
    />
  );
  expect(state.combo).toMatchObject({ disabled: false, allowClear: false });
  view.rerender(
    <PqlCombobox
      options={[]}
      onValueChange={vi.fn()}
      placeholder="p"
      searchPlaceholder="s"
      emptyText="e"
      disabled
      allowClear
    />
  );
  expect(state.combo).toMatchObject({ disabled: true, allowClear: true });
});

it('forwards default query issues', () => {
  render(<PqlQueryEditor fields={[]} value="" onChange={vi.fn()} />);
  expect(state.editor.issues).toEqual([]);
});

it('renders edit/valid builder states and dispatches label and cancel callbacks', () => {
  const onLabelChange = vi.fn();
  const onOpenChange = vi.fn();
  const view = render(
    <PqlFilterBuilderDialogView
      fields={[]}
      filter={{ id: 'one', label: 'One', query: 'x' }}
      isLabelValid
      isQueryValid
      isValid
      issues={[]}
      label="One"
      onLabelChange={onLabelChange}
      onOpenChange={onOpenChange}
      onQueryChange={vi.fn()}
      onSave={vi.fn()}
      open
      query="x"
      queryPlaceholder="q"
    />
  );
  fireEvent.change(document.querySelector('#pql-filter-label')!, { target: { value: 'Changed' } });
  fireEvent.click(document.querySelector('[data-action-id="pql.filter-builder.cancel"]')!);
  expect(onLabelChange).toHaveBeenCalledWith('Changed');
  expect(onOpenChange).toHaveBeenCalledWith(false);

  view.rerender(
    <PqlFilterBuilderDialogView
      fields={[]}
      filter={null}
      isLabelValid={false}
      isQueryValid={false}
      isValid={false}
      issues={[]}
      label=""
      onLabelChange={onLabelChange}
      onOpenChange={onOpenChange}
      onQueryChange={vi.fn()}
      onSave={vi.fn()}
      open
      query=""
      queryPlaceholder="q"
    />
  );
});
