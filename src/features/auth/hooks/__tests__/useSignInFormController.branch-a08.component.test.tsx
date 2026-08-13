/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  storeError: null as string | null,
  clearError: vi.fn(),
  isSigningIn: false,
  signIn: vi.fn(),
  sendMagicLink: vi.fn(),
  isRedirecting: false,
  continueWithGoogle: vi.fn(),
  translate: vi.fn((key: string) => key),
}));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('@/features/auth/auth.ts', () => ({
  useAuthStore: () => ({ error: mocks.storeError, clearError: mocks.clearError }),
}));
vi.mock('../useAuthSignIn', () => ({
  useAuthSignIn: () => ({
    isSigningIn: mocks.isSigningIn,
    signIn: mocks.signIn,
    sendMagicLink: mocks.sendMagicLink,
  }),
}));
vi.mock('../useGoogleAuth', () => ({
  useGoogleAuth: () => ({
    isRedirecting: mocks.isRedirecting,
    continueWithGoogle: mocks.continueWithGoogle,
  }),
}));
vi.mock('@/features/shared/hooks/use-debounce', () => ({ useDebounce: (value: string) => value }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: mocks.translate }),
}));

import { readRouteSignInRedirect, useSignInFormController } from '../useSignInFormController';

function submitEvent() {
  return { preventDefault: vi.fn() } as any;
}

function enterCredentials(
  result: { current: ReturnType<typeof useSignInFormController> },
  email = ' ada@example.test ',
  password = 'secret'
) {
  act(() => result.current.onEmailChange(email));
  act(() => result.current.onPasswordChange(password));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.storeError = null;
  mocks.isSigningIn = false;
  mocks.isRedirecting = false;
  mocks.signIn.mockResolvedValue({ success: true, isNewUser: false });
  mocks.sendMagicLink.mockResolvedValue({ success: true });
  mocks.continueWithGoogle.mockResolvedValue(undefined);
  mocks.translate.mockImplementation((key: string) => key);
  sessionStorage.clear();
  window.history.replaceState({}, '', '/auth/sign-in');
});

describe('useSignInFormController', () => {
  it('reads a route redirect in the browser and returns none during server rendering', () => {
    window.history.replaceState({}, '', '/auth/sign-in?redirect=%2Ftodos%3Ffilter%3Dmine%23today');
    expect(readRouteSignInRedirect()).toBe('/todos?filter=mine#today');

    const browserWindow = window;
    vi.stubGlobal('window', undefined);
    expect(readRouteSignInRedirect()).toBeNull();
    vi.stubGlobal('window', browserWindow);
  });

  it('exposes store errors, translated copy and independent loading sources', () => {
    mocks.storeError = 'provider error';
    mocks.isRedirecting = true;
    const { result, rerender } = renderHook(() => useSignInFormController());

    expect(result.current).toMatchObject({
      email: '',
      password: '',
      displayError: 'provider error',
      isLoading: true,
      isSigningIn: false,
      isRedirecting: true,
      emailIsValid: false,
      showEmailError: false,
      showEmailSuccess: false,
    });
    expect(result.current.copy.title).toBe('auth.signIn.title');

    mocks.storeError = null;
    mocks.isRedirecting = false;
    mocks.isSigningIn = true;
    rerender();
    expect(result.current).toMatchObject({ isLoading: true, displayError: null });
  });

  it('shows semantic email validation after interaction', () => {
    const { result } = renderHook(() => useSignInFormController());

    act(() => result.current.onEmailBlur());
    expect(result.current).toMatchObject({ showEmailError: false, showEmailSuccess: false });

    act(() => result.current.onEmailChange('invalid'));
    expect(result.current).toMatchObject({
      trimmedEmail: 'invalid',
      emailIsValid: false,
      showEmailError: true,
      showEmailSuccess: false,
    });

    act(() => result.current.onEmailChange(' ada@example.test '));
    expect(result.current).toMatchObject({
      trimmedEmail: 'ada@example.test',
      emailIsValid: true,
      showEmailError: false,
      showEmailSuccess: true,
    });
  });

  it('does not submit missing credentials and explains malformed email', async () => {
    const { result } = renderHook(() => useSignInFormController());
    const empty = submitEvent();

    await act(async () => result.current.onSubmit(empty));
    expect(empty.preventDefault).toHaveBeenCalledOnce();

    act(() => result.current.onEmailChange('ada@example.test'));
    await act(async () => result.current.onSubmit(submitEvent()));
    act(() => result.current.onEmailChange('invalid'));
    act(() => result.current.onPasswordChange('secret'));
    await act(async () => result.current.onSubmit(submitEvent()));

    expect(mocks.signIn).not.toHaveBeenCalled();
    expect(result.current.displayError).toBe('auth.signIn.emailHint');
  });

  it.each([
    [false, null],
    [true, 'true'],
  ])(
    'navigates after sign-in and records onboarding only for new=%s',
    async (isNewUser, stored) => {
      mocks.signIn.mockResolvedValue({ success: true, isNewUser });
      const { result } = renderHook(() => useSignInFormController());
      enterCredentials(result);

      await act(async () => result.current.onSubmit(submitEvent()));

      expect(mocks.signIn).toHaveBeenCalledWith('ada@example.test', 'secret');
      expect(sessionStorage.getItem('polity_onboarding')).toBe(stored);
      expect(mocks.navigate).toHaveBeenCalledWith({ to: '/' });
    }
  );

  it('prefers the validated route redirect after sign-in', async () => {
    window.history.replaceState({}, '', '/auth/sign-in?redirect=%2Ftodos%3Ffilter%3Dmine%23today');
    const { result } = renderHook(() => useSignInFormController());
    enterCredentials(result);

    await act(async () => result.current.onSubmit(submitEvent()));

    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/todos?filter=mine#today' });
  });

  it('shows explicit sign-in failures and permits a failure without provider text', async () => {
    mocks.signIn
      .mockResolvedValueOnce({ success: false, isNewUser: false, error: 'account locked' })
      .mockResolvedValueOnce({ success: false, isNewUser: false });
    const { result } = renderHook(() => useSignInFormController());
    enterCredentials(result);

    await act(async () => result.current.onSubmit(submitEvent()));
    expect(result.current.displayError).toBe('account locked');
    await act(async () => result.current.onSubmit(submitEvent()));
    expect(result.current.displayError).toBeNull();
  });

  it('validates magic-link email before sending', async () => {
    const { result } = renderHook(() => useSignInFormController());

    await act(async () => result.current.onMagicLink());
    expect(result.current.displayError).toBe('auth.signIn.emailHint');
    act(() => result.current.onEmailChange('invalid'));
    await act(async () => result.current.onMagicLink());

    expect(mocks.sendMagicLink).not.toHaveBeenCalled();
  });

  it('navigates to verification after sending a magic link', async () => {
    const { result } = renderHook(() => useSignInFormController());
    act(() => result.current.onEmailChange(' ada@example.test '));

    await act(async () => result.current.onMagicLink());

    expect(result.current.magicLinkSent).toBe(true);
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: '/auth/verify',
      search: { email: 'ada@example.test' },
    });

    act(() => result.current.onEmailChange('next@example.test'));
    expect(result.current.magicLinkSent).toBe(false);
  });

  it('shows explicit and empty magic-link delivery failures', async () => {
    mocks.sendMagicLink
      .mockResolvedValueOnce({ success: false, error: 'mailbox rejected' })
      .mockResolvedValueOnce({ success: false });
    const { result } = renderHook(() => useSignInFormController());
    act(() => result.current.onEmailChange('ada@example.test'));

    await act(async () => result.current.onMagicLink());
    expect(result.current.displayError).toBe('mailbox rejected');
    await act(async () => result.current.onMagicLink());
    expect(result.current.displayError).toBeNull();
  });

  it('clears local errors for Google auth and exposes navigation actions', async () => {
    const { result } = renderHook(() => useSignInFormController());
    act(() => result.current.onEmailChange('invalid'));
    await act(async () => result.current.onMagicLink());

    await act(async () => result.current.onGoogleAuth());
    expect(mocks.continueWithGoogle).toHaveBeenCalledWith('sign-in');
    expect(result.current.displayError).toBeNull();

    act(() => result.current.onForgotPassword());
    expect(mocks.navigate).toHaveBeenLastCalledWith({
      to: '/auth/forgot-password',
      search: { email: 'invalid' },
    });
    act(() => result.current.onEmailChange(''));
    act(() => result.current.onForgotPassword());
    expect(mocks.navigate).toHaveBeenLastCalledWith({
      to: '/auth/forgot-password',
      search: { email: undefined },
    });
    act(() => result.current.onGoToSignUp());
    expect(mocks.navigate).toHaveBeenLastCalledWith({ to: '/auth/sign-up' });
  });
});
