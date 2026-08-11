/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  storeError: null as string | null,
  clearError: vi.fn(),
  isSigningUp: false,
  isSendingMagicLink: false,
  signUp: vi.fn(),
  sendMagicLink: vi.fn(),
  isRedirecting: false,
  google: vi.fn(),
  translate: vi.fn((key: string) => key),
}));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('@/features/auth/auth.ts', () => ({
  useAuthStore: () => ({ error: mocks.storeError, clearError: mocks.clearError }),
}));
vi.mock('../useAuthSignUp', () => ({
  useAuthSignUp: () => ({
    isSigningUp: mocks.isSigningUp,
    isSendingMagicLink: mocks.isSendingMagicLink,
    signUp: mocks.signUp,
    sendMagicLink: mocks.sendMagicLink,
  }),
}));
vi.mock('../useGoogleAuth', () => ({
  useGoogleAuth: () => ({ isRedirecting: mocks.isRedirecting, continueWithGoogle: mocks.google }),
}));
vi.mock('@/features/shared/hooks/use-debounce', () => ({ useDebounce: (value: string) => value }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: mocks.translate }),
}));

import { useSignUpFormController } from '../useSignUpFormController';

function event() {
  return { preventDefault: vi.fn() } as any;
}

function setFields(
  result: { current: ReturnType<typeof useSignUpFormController> },
  email = 'person@example.test',
  password = 'secret1',
  confirmation = password
) {
  act(() => result.current.onEmailChange(email));
  act(() => result.current.onPasswordChange(password));
  act(() => result.current.onConfirmPasswordChange(confirmation));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.storeError = null;
  mocks.isSigningUp = false;
  mocks.isSendingMagicLink = false;
  mocks.isRedirecting = false;
  mocks.signUp.mockResolvedValue({ status: 'authenticated' });
  mocks.sendMagicLink.mockResolvedValue({ success: true });
  mocks.google.mockResolvedValue(undefined);
  mocks.translate.mockImplementation((key: string) => key);
  sessionStorage.clear();
});

describe('useSignUpFormController validation', () => {
  it('exposes empty copy and store errors before interaction', () => {
    mocks.storeError = 'auth-store-error';
    const { result } = renderHook(() => useSignUpFormController());
    expect(result.current).toMatchObject({
      email: '',
      password: '',
      confirmPassword: '',
      displayError: 'auth-store-error',
      isFormValid: false,
      magicLinkDisabled: true,
      showEmailError: false,
      showPasswordError: false,
      showConfirmPasswordError: false,
    });
    expect(result.current.copy.title).toBe('auth.signUp.title');
    expect(mocks.translate).toHaveBeenCalledWith('auth.signUp.confirmationPendingDescription', {
      email: '',
    });
  });

  it('covers every form-validity boundary and validation indicator', () => {
    const { result } = renderHook(() => useSignUpFormController());
    act(() => {
      result.current.onEmailBlur();
      result.current.onPasswordBlur();
      result.current.onConfirmPasswordBlur();
    });
    expect(result.current).toMatchObject({
      showEmailError: false,
      showEmailSuccess: false,
      showPasswordError: false,
      showPasswordSuccess: false,
      showConfirmPasswordError: false,
      showConfirmPasswordSuccess: false,
    });

    act(() => result.current.onEmailChange('invalid'));
    expect(result.current).toMatchObject({
      isFormValid: false,
      magicLinkDisabled: true,
      showEmailError: true,
      showEmailSuccess: false,
    });
    act(() => result.current.onEmailChange(' person@example.test '));
    expect(result.current).toMatchObject({
      isFormValid: false,
      magicLinkDisabled: false,
      showEmailError: false,
      showEmailSuccess: true,
    });

    act(() => result.current.onPasswordChange('short'));
    expect(result.current).toMatchObject({
      isFormValid: false,
      showPasswordError: true,
      showPasswordSuccess: false,
    });
    act(() => result.current.onPasswordChange('secret1'));
    expect(result.current).toMatchObject({
      isFormValid: false,
      showPasswordError: false,
      showPasswordSuccess: true,
    });

    act(() => result.current.onConfirmPasswordChange('different'));
    expect(result.current).toMatchObject({
      isFormValid: false,
      showConfirmPasswordError: true,
      showConfirmPasswordSuccess: false,
    });
    act(() => result.current.onConfirmPasswordChange('secret1'));
    expect(result.current).toMatchObject({
      isFormValid: true,
      showConfirmPasswordError: false,
      showConfirmPasswordSuccess: true,
    });
  });

  it('distinguishes missing password, missing confirmation and invalid email validity operands', () => {
    const { result } = renderHook(() => useSignUpFormController());
    act(() => result.current.onEmailChange('person@example.test'));
    expect(result.current.isFormValid).toBe(false);
    act(() => result.current.onPasswordChange('secret1'));
    expect(result.current.isFormValid).toBe(false);
    act(() => result.current.onEmailChange('invalid'));
    act(() => result.current.onConfirmPasswordChange('secret1'));
    expect(result.current.isFormValid).toBe(false);
  });
});

describe('useSignUpFormController signup', () => {
  it('stops at missing fields and reports invalid email, password and confirmation', async () => {
    const { result } = renderHook(() => useSignUpFormController());
    const firstEvent = event();
    await act(async () => result.current.onSubmit(firstEvent));
    expect(firstEvent.preventDefault).toHaveBeenCalled();

    act(() => result.current.onEmailChange('invalid'));
    act(() => result.current.onPasswordChange('secret1'));
    act(() => result.current.onConfirmPasswordChange('secret1'));
    await act(async () => result.current.onSubmit(event()));
    expect(result.current.displayError).toBe('auth.signUp.emailHint');

    setFields(result, 'person@example.test', 'short', 'short');
    await act(async () => result.current.onSubmit(event()));
    expect(result.current.displayError).toBe('auth.signUp.passwordTooShort');

    setFields(result, 'person@example.test', 'secret1', 'secret2');
    await act(async () => result.current.onSubmit(event()));
    expect(result.current.displayError).toBe('auth.signUp.passwordMismatch');
    expect(mocks.signUp).not.toHaveBeenCalled();
    expect(mocks.clearError).toHaveBeenCalledTimes(4);
  });

  it('marks authenticated signups for onboarding and navigates home', async () => {
    const { result } = renderHook(() => useSignUpFormController());
    setFields(result, ' person@example.test ');
    await act(async () => result.current.onSubmit(event()));
    expect(mocks.signUp).toHaveBeenCalledWith('person@example.test', 'secret1');
    expect(sessionStorage.getItem('polity_onboarding')).toBe('true');
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/' });
  });

  it('shows confirmation-required state and resets it for another email', async () => {
    mocks.signUp.mockResolvedValue({ status: 'confirmation_required' });
    const { result } = renderHook(() => useSignUpFormController());
    setFields(result);
    await act(async () => result.current.onSubmit(event()));
    expect(result.current.pendingConfirmationEmail).toBe('person@example.test');
    expect(mocks.translate).toHaveBeenCalledWith('auth.signUp.confirmationPendingDescription', {
      email: 'person@example.test',
    });

    act(() => result.current.onUseDifferentEmail());
    expect(result.current).toMatchObject({
      pendingConfirmationEmail: null,
      email: 'person@example.test',
      password: '',
      confirmPassword: '',
    });
  });

  it('shows explicit and empty signup failures', async () => {
    mocks.signUp
      .mockResolvedValueOnce({ status: 'failed', error: 'already-registered' })
      .mockResolvedValueOnce({ status: 'failed' });
    const { result } = renderHook(() => useSignUpFormController());
    setFields(result);
    await act(async () => result.current.onSubmit(event()));
    expect(result.current.displayError).toBe('already-registered');
    await act(async () => result.current.onSubmit(event()));
    expect(result.current.displayError).toBeNull();
  });
});

describe('useSignUpFormController alternate authentication', () => {
  it('clears errors and starts Google sign-up', async () => {
    const { result } = renderHook(() => useSignUpFormController());
    act(() => result.current.onEmailChange('invalid'));
    await act(async () => result.current.onMagicLink());
    expect(result.current.displayError).toBe('auth.signUp.emailHint');

    await act(async () => result.current.onGoogleAuth());
    expect(mocks.clearError).toHaveBeenCalled();
    expect(mocks.google).toHaveBeenCalledWith('sign-up');
    expect(result.current.displayError).toBeNull();
  });

  it('validates magic-link email and navigates on success', async () => {
    const { result } = renderHook(() => useSignUpFormController());
    await act(async () => result.current.onMagicLink());
    expect(result.current.displayError).toBe('auth.signUp.emailHint');
    expect(mocks.sendMagicLink).not.toHaveBeenCalled();

    act(() => result.current.onEmailChange(' person@example.test '));
    await act(async () => result.current.onMagicLink());
    expect(mocks.sendMagicLink).toHaveBeenCalledWith('person@example.test');
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: '/auth/verify',
      search: { email: 'person@example.test' },
    });
  });

  it('shows explicit and empty magic-link failures', async () => {
    mocks.sendMagicLink
      .mockResolvedValueOnce({ success: false, error: 'rate-limited' })
      .mockResolvedValueOnce({ success: false });
    const { result } = renderHook(() => useSignUpFormController());
    act(() => result.current.onEmailChange('person@example.test'));

    await act(async () => result.current.onMagicLink());
    expect(result.current.displayError).toBe('rate-limited');
    await act(async () => result.current.onMagicLink());
    expect(result.current.displayError).toBeNull();
  });

  it('combines each loading source and disables magic link while busy', () => {
    const { result, rerender } = renderHook(() => useSignUpFormController());
    act(() => result.current.onEmailChange('person@example.test'));
    expect(result.current).toMatchObject({ isLoading: false, magicLinkDisabled: false });

    mocks.isSigningUp = true;
    rerender();
    expect(result.current).toMatchObject({ isLoading: true, magicLinkDisabled: true });
    mocks.isSigningUp = false;
    mocks.isSendingMagicLink = true;
    rerender();
    expect(result.current.isLoading).toBe(true);
    mocks.isSendingMagicLink = false;
    mocks.isRedirecting = true;
    rerender();
    expect(result.current).toMatchObject({ isLoading: true, isRedirecting: true });
  });

  it('navigates to sign in', () => {
    const { result } = renderHook(() => useSignUpFormController());
    act(() => result.current.onGoToSignIn());
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/auth/sign-in' });
  });
});
