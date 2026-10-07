// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
const mocks = vi.hoisted(() => ({
  enabled: false,
  providers: [] as string[],
  start: vi.fn(),
  toast: vi.fn(),
  authenticated: true,
}));
vi.mock('@/features/auth/logic/chatgptAuth', () => ({
  CHATGPT_AUTH_PROVIDER: 'custom:openai',
  isChatGptLoginEnabled: () => mocks.enabled,
  startChatGptAuth: mocks.start,
}));
vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    user: mocks.authenticated ? { id: 'existing-user', linkedProviders: mocks.providers } : null,
  }),
}));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({ toast: { error: mocks.toast } }));
import { ChatGptLoginButton } from '../ChatGptLoginButton';
import { ChatGptConnectionCard } from '@/features/users/ui/ChatGptConnectionCard';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.enabled = false;
  mocks.providers = [];
  mocks.authenticated = true;
  mocks.start.mockResolvedValue(undefined);
});

it('disables account linking without an authenticated Polity user', async () => {
  mocks.enabled = true;
  mocks.authenticated = false;
  render(<ChatGptConnectionCard />);
  const button = screen.getByRole('button', { name: 'pages.user.ai.chatgpt.link' });
  expect(button).toHaveProperty('disabled', true);
  fireEvent.click(button);
  expect(mocks.start).not.toHaveBeenCalled();
});

it.each(['login', 'link'])(
  'starts %s by keyboard, retains focus and blocks duplicate submissions while redirecting',
  async mode => {
    mocks.enabled = true;
    let resolve!: () => void;
    mocks.start.mockReturnValue(
      new Promise<void>(done => {
        resolve = done;
      })
    );
    render(mode === 'login' ? <ChatGptLoginButton /> : <ChatGptConnectionCard />);
    const button = screen.getByRole('button');
    expect(button).toHaveProperty('disabled', false);
    const user = userEvent.setup();
    await user.tab();
    expect(document.activeElement).toBe(button);
    await user.keyboard('{Enter}');
    expect(mocks.start).toHaveBeenCalledWith({}, expect.objectContaining({ mode }));
    expect(button).toHaveProperty('disabled', true);
    if (mode === 'login') expect(button.textContent).toBe('auth.chatgpt.loading');
    await user.keyboard('{Enter}');
    expect(mocks.start).toHaveBeenCalledTimes(1);
    await act(async () => resolve());
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(button).toHaveProperty('disabled', true);
  }
);

it('keeps identity login disabled when its parent form is busy', () => {
  mocks.enabled = true;
  render(<ChatGptLoginButton disabled />);
  const button = screen.getByRole('button');
  expect(button).toHaveProperty('disabled', true);
  fireEvent.click(button);
  expect(mocks.start).not.toHaveBeenCalled();
});

it('keeps login disabled and reports AI access separately before activation', () => {
  render(
    <>
      <ChatGptLoginButton />
      <ChatGptConnectionCard />
    </>
  );
  expect(screen.queryByRole('button', { name: 'auth.chatgpt.button' })).toBeNull();
  expect(
    (screen.getByRole('button', { name: 'pages.user.ai.chatgpt.link' }) as HTMLButtonElement)
      .disabled
  ).toBe(true);
  expect(screen.getByText('pages.user.ai.chatgpt.planUnavailable')).toBeTruthy();
  expect(mocks.start).not.toHaveBeenCalled();
});

it('a linked login never appears as usable ChatGPT plan access', () => {
  mocks.enabled = true;
  mocks.providers = ['custom:openai'];
  render(<ChatGptConnectionCard />);
  expect(screen.getByText('pages.user.ai.chatgpt.connected')).toBeTruthy();
  expect(screen.getByText('pages.user.ai.chatgpt.planUnavailable')).toBeTruthy();
  expect(screen.queryByRole('button')).toBeNull();
});

it('explicitly links from the current Polity account and recovers after a rejected link', async () => {
  mocks.enabled = true;
  mocks.start.mockRejectedValueOnce(new Error('cancelled'));
  render(<ChatGptConnectionCard />);
  const button = screen.getByRole('button', { name: 'pages.user.ai.chatgpt.link' });
  expect(button.getAttribute('data-action-id')).toBe('users.ai.chatgpt.link');
  fireEvent.click(button);
  await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith('auth.chatgpt.failed'));
  expect(mocks.start).toHaveBeenCalledWith({}, expect.objectContaining({ mode: 'link' }));
  expect((button as HTMLButtonElement).disabled).toBe(false);
});

it('starts identity login only after activation and exposes the failure for retry', async () => {
  mocks.enabled = true;
  mocks.start.mockRejectedValueOnce(new Error('cancelled'));
  render(<ChatGptLoginButton />);
  const button = screen.getByRole('button', { name: 'auth.chatgpt.button' });
  expect(button.getAttribute('data-action-id')).toBe('auth.authenticate.chatgpt');
  fireEvent.click(button);
  await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith('auth.chatgpt.failed'));
  expect(mocks.start).toHaveBeenCalledWith({}, expect.objectContaining({ mode: 'login' }));
  expect((button as HTMLButtonElement).disabled).toBe(false);
});
