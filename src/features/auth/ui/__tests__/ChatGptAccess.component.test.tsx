// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
const mocks = vi.hoisted(() => ({
  enabled: false,
  providers: [] as string[],
  start: vi.fn(),
  toast: vi.fn(),
}));
vi.mock('@/features/auth/logic/chatgptAuth', () => ({
  CHATGPT_AUTH_PROVIDER: 'custom:openai',
  isChatGptLoginEnabled: () => mocks.enabled,
  startChatGptAuth: mocks.start,
}));
vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: 'existing-user', linkedProviders: mocks.providers } }),
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
  mocks.start.mockResolvedValue(undefined);
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
