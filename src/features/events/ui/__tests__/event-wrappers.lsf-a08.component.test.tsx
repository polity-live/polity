/* @vitest-environment jsdom */

import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cancelController: vi.fn((props: unknown) => props),
  cancelView: vi.fn(() => null),
  subscribeView: vi.fn((_props: any) => null),
  toggle: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../useCancelEventDialogController', () => ({
  useCancelEventDialogController: mocks.cancelController,
}));
vi.mock('../CancelEventDialogView', () => ({ CancelEventDialogView: mocks.cancelView }));
vi.mock('../../hooks/useSubscribeEvent', () => ({
  useSubscribeEvent: () => ({
    isSubscribed: false,
    toggleSubscribe: mocks.toggle,
    isLoading: false,
  }),
}));
vi.mock('../EventSubscribeButtonView', () => ({ EventSubscribeButtonView: mocks.subscribeView }));

import { CancelEventDialog } from '../CancelEventDialog';
import { EventSubscribeButton } from '../EventSubscribeButton';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('event LSF wrapper contracts', () => {
  it('connects the cancellation controller to its view', () => {
    const onOpenChange = vi.fn();
    render(
      <CancelEventDialog eventId="event-1" groupId="group-1" open onOpenChange={onOpenChange} />
    );
    expect(mocks.cancelController).toHaveBeenCalledWith({
      eventId: 'event-1',
      groupId: 'group-1',
      open: true,
      onOpenChange,
    });
    expect(mocks.cancelView).toHaveBeenCalledOnce();
  });

  it('toggles a subscription and reports its inverse state', async () => {
    const onSubscribeChange = vi.fn();
    render(<EventSubscribeButton eventId="event-1" onSubscribeChange={onSubscribeChange} />);
    const props = mocks.subscribeView.mock.calls[0][0];
    await props.handleClick();
    await waitFor(() => expect(mocks.toggle).toHaveBeenCalledOnce());
    expect(onSubscribeChange).toHaveBeenCalledWith(true);
  });
});
