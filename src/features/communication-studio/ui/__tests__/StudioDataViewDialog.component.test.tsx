// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { StudioDataViewDialog } from '../StudioDataViewDialog';
import { configuration, projection } from '@/test/studio-data-view.fixture';

const io = vi.hoisted(() => ({
  model: null as any,
  options: null as any,
  query: vi.fn(),
  reset: vi.fn(),
  setOpen: vi.fn(),
  save: vi.fn(),
  canInsert: true,
}));
vi.mock('@/zero/observed-query', () => ({
  useQuery: (query: unknown) => {
    io.query(query);
    return [undefined];
  },
}));
vi.mock('@/features/charts/hooks/useDataViewBuilderModel', () => ({
  useDataViewBuilderModel: (options: unknown) => {
    io.options = options;
    return {
      open: true,
      resetDialog: io.reset,
      setOpen: io.setOpen,
      save: io.save,
      canInsert: io.canInsert,
    };
  },
}));
vi.mock('@/features/charts/ui/DataViewDialogView', () => ({
  DataViewDialogView: ({ model }: { model: unknown }) => {
    io.model = model;
    return <div />;
  },
}));
beforeEach(() => {
  vi.clearAllMocks();
  io.canInsert = true;
});
afterEach(cleanup);

it('synchronizes personal and group dialogs, functional open changes, and successful insertion', () => {
  const onOpenChange = vi.fn(),
    onInsert = vi.fn();
  const props = {
    open: true,
    disabled: false,
    groupId: null,
    userId: crypto.randomUUID(),
    onOpenChange,
    onInsert,
  };
  const view = render(<StudioDataViewDialog {...props} />);
  expect(io.query).toHaveBeenCalledWith(undefined);
  expect(io.reset).toHaveBeenCalledOnce();
  expect(io.options.canInsert).toBe(true);
  expect(io.options.validate(projection, 'bar')).toBeNull();
  act(() => io.model.setOpen((open: boolean) => !open));
  expect(onOpenChange).toHaveBeenLastCalledWith(false);
  act(() => io.model.setOpen(true));
  expect(io.setOpen).toHaveBeenLastCalledWith(true);
  act(() => io.model.save());
  expect(io.save).toHaveBeenCalledOnce();
  act(() => io.options.onInsert(configuration(), projection));
  expect(onInsert).toHaveBeenCalledWith(configuration(), projection);
  expect(onOpenChange).toHaveBeenLastCalledWith(false);
  view.rerender(<StudioDataViewDialog {...props} open={false} groupId={crypto.randomUUID()} />);
  expect(io.query.mock.calls.at(-1)?.[0]).toBeDefined();
  view.rerender(<StudioDataViewDialog {...props} />);
  expect(io.reset).toHaveBeenCalledTimes(2);
});

it('rejects read-only insertions and never dispatches a disabled builder save', () => {
  io.canInsert = false;
  const onInsert = vi.fn();
  render(
    <StudioDataViewDialog
      open
      disabled
      groupId={null}
      userId={crypto.randomUUID()}
      onOpenChange={vi.fn()}
      onInsert={onInsert}
    />
  );
  expect(io.options.canInsert).toBe(false);
  expect(io.options.validate(projection, 'bar')).toBeTruthy();
  act(() => io.model.save());
  expect(io.save).not.toHaveBeenCalled();
  expect(onInsert).not.toHaveBeenCalled();
});
