/* @vitest-environment jsdom */
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const io = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('@/zero/communication-studio/useStudioClient', async () => {
  const { studioClientFixture } = await import('@/test/studio-client.fixture');
  return { useStudioClient: () => studioClientFixture(io) };
});
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
}));
import { StudioVisibilityDialog } from '../StudioVisibilityDialog';
beforeEach(() => {
  io.request.mockReset().mockResolvedValue({});
});
afterEach(cleanup);
it('saves visibility by keyboard and disables both actions while awaiting the server', async () => {
  let resolve!: (value: unknown) => void;
  io.request.mockReturnValue(
    new Promise(complete => {
      resolve = complete;
    })
  );
  const close = vi.fn();
  render(
    <StudioVisibilityDialog projectId="project" visibility="private" open onOpenChange={close} />
  );
  const user = userEvent.setup();
  const submit = screen.getByRole('button', { name: 'common.actions.save' });
  const cancel = screen.getByRole('button', { name: 'common.cancel' });
  expect(submit).toHaveProperty('disabled', false);
  submit.focus();
  expect(document.activeElement).toBe(submit);
  await user.keyboard('{Enter}');
  expect(submit).toHaveProperty('disabled', true);
  expect(cancel).toHaveProperty('disabled', true);
  await user.click(submit);
  await user.click(cancel);
  expect(io.request).toHaveBeenCalledOnce();
  expect(io.request).toHaveBeenCalledWith('visibility', { id: 'project', visibility: 'private' });
  expect(close).not.toHaveBeenCalled();
  await act(async () => resolve({}));
  expect(close).toHaveBeenCalledWith(false);
});
it.each([new Error('Authentication required'), 'Visibility unavailable'])(
  'keeps failed visibility edits available for retry and keyboard cancellation after %s',
  async reason => {
    io.request.mockRejectedValueOnce(reason);
    const close = vi.fn();
    render(
      <StudioVisibilityDialog projectId="project" visibility="public" open onOpenChange={close} />
    );
    const user = userEvent.setup();
    const submit = screen.getByRole('button', { name: 'common.actions.save' });
    submit.focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      reason instanceof Error ? reason.message : reason
    );
    expect(submit).toHaveProperty('disabled', false);
    expect(close).not.toHaveBeenCalled();
    const cancel = screen.getByRole('button', { name: 'common.cancel' });
    cancel.focus();
    expect(document.activeElement).toBe(cancel);
    await user.keyboard(' ');
    expect(close).toHaveBeenCalledWith(false);
  }
);
