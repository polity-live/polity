import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { SignInFormView } from '../SignInFormView';
import { SignUpFormView } from '../SignUpFormView';

const io = vi.hoisted(() => ({ enabled: true, start: vi.fn(), toast: vi.fn(), client: {} }));
vi.mock('@/features/auth/logic/chatgptAuth', () => ({
  isChatGptLoginEnabled: () => io.enabled,
  startChatGptAuth: io.start,
}));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => io.client }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({ toast: { error: io.toast } }));

beforeEach(() => {
  vi.clearAllMocks();
  io.enabled = true;
  io.start.mockResolvedValue(undefined);
});

it.each(['sign-in', 'sign-up'] as const)(
  'restores the login button focus in the %s form when a failed request leaves no field focused',
  async mode => {
    let reject!: (error: Error) => void;
    io.start.mockReturnValueOnce(
      new Promise<void>((_resolve, fail) => {
        reject = fail;
      })
    );
    render(form(mode));
    const button = screen.getByRole('button', { name: 'auth.chatgpt.button' });
    button.focus();
    await userEvent.keyboard('{Enter}');
    button.blur();
    expect(document.activeElement).toBe(document.body);
    await act(async () => reject(new Error('OAuth denied')));
    await waitFor(() => expect(io.toast).toHaveBeenCalledWith('auth.chatgpt.failed'));
    await waitFor(() => expect(document.activeElement).toBe(button));
    expect((button as HTMLButtonElement).disabled).toBe(false);
  }
);

it.each(['sign-in', 'sign-up'] as const)(
  'preserves another focused field in the %s form when a pending ChatGPT login fails',
  async mode => {
    let reject: (error: Error) => void = () => {
      throw new Error('Missing auth request');
    };
    io.start.mockReturnValueOnce(
      new Promise<void>((_resolve, fail) => {
        reject = fail;
      })
    );
    render(form(mode));
    const button = screen.getByRole('button', { name: 'auth.chatgpt.button' });
    button.focus();
    await userEvent.keyboard('{Enter}');
    const email = screen.getByRole('textbox', { name: new RegExp(`${mode}.emailLabel`) });
    email.focus();
    await act(async () => reject(new Error('OAuth denied')));
    await waitFor(() => expect(io.toast).toHaveBeenCalledWith('auth.chatgpt.failed'));
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    expect(document.activeElement).toBe(email);
    expect((button as HTMLButtonElement).disabled).toBe(false);
  }
);

function form(mode: 'sign-in' | 'sign-up', busy = false) {
  const copy = Object.fromEntries(
    'title description emailLabel emailPlaceholder emailHint passwordLabel passwordPlaceholder passwordHint confirmPasswordLabel confirmPasswordPlaceholder confirmPasswordHint forgotPassword magicLinkSent submit submitting googleButton googleLoading magicLinkAlt magicLinkSending sendCode noAccount signUpLink hasAccount signInLink confirmationPendingTitle confirmationPendingDescription confirmationPendingInstructions useDifferentEmail'
      .split(' ')
      .map(key => [key, `${mode}.${key}`])
  );
  const props = {
    copy,
    email: '',
    password: '',
    confirmPassword: '',
    pendingConfirmationEmail: null,
    displayError: null,
    isLoading: busy,
    isSigningIn: false,
    isSigningUp: false,
    isRedirecting: false,
    isSendingMagicLink: false,
    isFormValid: false,
    magicLinkDisabled: true,
    magicLinkSent: false,
    trimmedEmail: '',
    emailIsValid: false,
    showEmailError: false,
    showEmailSuccess: false,
    showPasswordError: false,
    showPasswordSuccess: false,
    showConfirmPasswordError: false,
    showConfirmPasswordSuccess: false,
    onSubmit: (event: React.FormEvent) => event.preventDefault(),
    onEmailChange: vi.fn(),
    onEmailBlur: vi.fn(),
    onPasswordChange: vi.fn(),
    onPasswordBlur: vi.fn(),
    onConfirmPasswordChange: vi.fn(),
    onConfirmPasswordBlur: vi.fn(),
    onMagicLink: vi.fn(),
    onGoogleAuth: vi.fn(),
    onForgotPassword: vi.fn(),
    onGoToSignUp: vi.fn(),
    onGoToSignIn: vi.fn(),
    onUseDifferentEmail: vi.fn(),
  };
  return mode === 'sign-in' ? (
    <SignInFormView {...(props as any)} />
  ) : (
    <SignUpFormView {...(props as any)} />
  );
}

it.each(['sign-in', 'sign-up'] as const)(
  'disables ChatGPT login in the busy %s form and removes it when the provider is unavailable',
  async mode => {
    const ui = render(form(mode, true));
    const button = screen.getByRole('button', { name: 'auth.chatgpt.button' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    button.focus();
    expect(document.activeElement).not.toBe(button);
    await userEvent.keyboard('{Enter}');
    expect(io.start).not.toHaveBeenCalled();
    ui.rerender(form(mode));
    expect(button.disabled).toBe(false);
    io.enabled = false;
    ui.rerender(form(mode));
    expect(screen.queryByRole('button', { name: 'auth.chatgpt.button' })).toBeNull();
    expect(io.start).not.toHaveBeenCalled();
  }
);

it.each(['sign-in', 'sign-up'] as const)(
  'starts ChatGPT login once from the %s form with native keyboard focus and retains its loading state after redirect acknowledgement',
  async mode => {
    let resolve: () => void = () => {
      throw new Error('Missing auth acknowledgement');
    };
    io.start.mockReturnValueOnce(
      new Promise<void>(done => {
        resolve = done;
      })
    );
    render(form(mode));
    const button = screen.getByRole('button', { name: 'auth.chatgpt.button' }) as HTMLButtonElement;
    expect(button.getAttribute('data-action-id')).toBe('auth.authenticate.chatgpt');
    expect(button.disabled).toBe(false);
    button.focus();
    expect(document.activeElement).toBe(button);
    await userEvent.keyboard('{Enter}');
    expect(io.start).toHaveBeenCalledWith(io.client, expect.objectContaining({ mode: 'login' }));
    expect(button.disabled).toBe(true);
    expect(button.textContent).toBe('auth.chatgpt.loading');
    await userEvent.keyboard('{Enter} ');
    expect(io.start).toHaveBeenCalledTimes(1);
    await act(async () => resolve());
    expect(button.disabled).toBe(true);
    expect(io.toast).not.toHaveBeenCalled();
  }
);

it.each(['sign-in', 'sign-up'] as const)(
  'reports failed ChatGPT login in the %s form and accepts a native keyboard retry',
  async mode => {
    io.start.mockRejectedValueOnce(new Error('OAuth denied'));
    render(form(mode));
    const button = screen.getByRole('button', { name: 'auth.chatgpt.button' }) as HTMLButtonElement;
    button.focus();
    await userEvent.keyboard(' ');
    await waitFor(() => expect(io.toast).toHaveBeenCalledWith('auth.chatgpt.failed'));
    await waitFor(() => expect(button.disabled).toBe(false));
    await waitFor(() => expect(document.activeElement).toBe(button));
    await userEvent.keyboard('{Enter}');
    expect(io.start).toHaveBeenCalledTimes(2);
    expect(button.disabled).toBe(true);
  }
);
