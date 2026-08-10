/* @vitest-environment jsdom */

import { act, render, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  search: {} as Record<string, string>,
  navigate: vi.fn(),
  requestMagicCode: vi.fn(),
  clearError: vi.fn(),
  authError: null as string | null,
  verify: vi.fn(),
  isVerifying: false,
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
  useSearch: () => mocks.search,
}));
vi.mock('@/features/auth/auth.ts', () => ({
  useAuthStore: () => ({
    requestMagicCode: mocks.requestMagicCode,
    clearError: mocks.clearError,
    error: mocks.authError,
  }),
}));
vi.mock('../useAuthVerification', () => ({
  useAuthVerification: () => ({
    isVerifying: mocks.isVerifying,
    verifyAndInitialize: mocks.verify,
  }),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: () => 'text',
}));

import { useVerifyFormController } from '../useVerifyFormController';

function input() {
  return { focus: vi.fn() } as unknown as HTMLInputElement;
}

function pasteEvent(value: string) {
  return {
    preventDefault: vi.fn(),
    clipboardData: { getData: vi.fn().mockReturnValue(value) },
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.search = { email: 'person@example.test' };
  mocks.authError = null;
  mocks.isVerifying = false;
  mocks.verify.mockResolvedValue({ success: true, isNewUser: false });
  mocks.requestMagicCode.mockResolvedValue(true);
  sessionStorage.clear();
});

afterEach(() => vi.restoreAllMocks());

describe('useVerifyFormController', () => {
  it('redirects when the email query parameter is absent and exposes translated copy', () => {
    mocks.search = {};
    mocks.authError = 'store-error';
    const { result } = renderHook(() => useVerifyFormController());

    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/auth/sign-in' });
    expect(result.current.email).toBe('');
    expect(result.current.displayError).toBe('store-error');
    expect(result.current.copy).toEqual({
      title: 'auth.verify.title',
      description: 'auth.verify.description',
      codeLabel: 'auth.verify.codeLabel',
      verifying: 'auth.verify.verifying',
      submit: 'auth.verify.submit',
      back: 'auth.verify.back',
      resend: 'auth.verify.resend',
      checkSpam: 'auth.verify.footer.checkSpam',
      devNote: 'auth.verify.footer.devNote',
    });
  });

  it('focuses the first input after a real component commit', () => {
    const focus = vi.spyOn(HTMLInputElement.prototype, 'focus');
    function Harness() {
      const controller = useVerifyFormController();
      return <input ref={element => controller.setInputRef(0, element)} />;
    }

    render(<Harness />);
    expect(focus).toHaveBeenCalledTimes(1);
  });

  it('ignores incomplete explicit verification and navigates back on request', () => {
    const { result } = renderHook(() => useVerifyFormController());
    act(() => result.current.onVerify());
    expect(mocks.verify).not.toHaveBeenCalled();

    act(() => result.current.onBackToEmail());
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/auth/sign-in' });
  });

  it('accepts only one digit, moves focus, and auto-verifies the completed code', async () => {
    const refs = Array.from({ length: 6 }, input);
    const { result } = renderHook(() => useVerifyFormController());
    act(() => refs.forEach((element, index) => result.current.setInputRef(index, element)));

    act(() => result.current.onCodeChange(0, 'x'));
    expect(result.current.code).toEqual(['', '', '', '', '', '']);

    for (let index = 0; index < 5; index += 1) {
      act(() => result.current.onCodeChange(index, String(index + 1)));
    }
    const lastInputFocusCount = vi.mocked(refs[5].focus).mock.calls.length;
    act(() => result.current.onCodeChange(5, '6'));
    expect(result.current.code).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(refs[1].focus).toHaveBeenCalled();
    expect(refs[5].focus).toHaveBeenCalledTimes(lastInputFocusCount);
    await waitFor(() => expect(mocks.verify).toHaveBeenCalledWith('person@example.test', '123456'));
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/' });

    act(() => result.current.onCodeChange(5, ''));
    expect(result.current.code[5]).toBe('');
  });

  it('handles keyboard focus movement and boundary keys', () => {
    const refs = Array.from({ length: 6 }, input);
    const { result } = renderHook(() => useVerifyFormController());
    act(() => refs.forEach((element, index) => result.current.setInputRef(index, element)));

    act(() => result.current.onCodeKeyDown(2, { key: 'Backspace' } as any));
    act(() => result.current.onCodeKeyDown(2, { key: 'ArrowLeft' } as any));
    act(() => result.current.onCodeKeyDown(2, { key: 'ArrowRight' } as any));
    expect(refs[1].focus).toHaveBeenCalledTimes(2);
    expect(refs[3].focus).toHaveBeenCalledTimes(1);

    act(() => result.current.onCodeChange(2, '3'));
    refs.forEach(element => vi.mocked(element.focus).mockClear());
    act(() => result.current.onCodeKeyDown(2, { key: 'Backspace' } as any));
    act(() => result.current.onCodeKeyDown(0, { key: 'ArrowLeft' } as any));
    act(() => result.current.onCodeKeyDown(5, { key: 'ArrowRight' } as any));
    act(() => result.current.onCodeKeyDown(3, { key: 'Enter' } as any));
    expect(refs.every(element => !vi.mocked(element.focus).mock.calls.length)).toBe(true);
  });

  it('sanitizes pasted input, ignores non-six-digit values and verifies valid codes', async () => {
    const invalid = pasteEvent('12ab');
    const valid = pasteEvent(' 12-34 56 ');
    const { result } = renderHook(() => useVerifyFormController());

    act(() => result.current.onCodePaste(invalid));
    expect(invalid.preventDefault).toHaveBeenCalled();
    expect(mocks.verify).not.toHaveBeenCalled();

    act(() => result.current.onCodePaste(valid));
    expect(result.current.code).toEqual(['1', '2', '3', '4', '5', '6']);
    await waitFor(() => expect(mocks.verify).toHaveBeenCalledWith('person@example.test', '123456'));
  });

  it('marks new users for onboarding and leaves existing users unmarked', async () => {
    mocks.verify
      .mockResolvedValueOnce({ success: true, isNewUser: true })
      .mockResolvedValueOnce({ success: true, isNewUser: false });
    const { result } = renderHook(() => useVerifyFormController());

    act(() => result.current.onCodePaste(pasteEvent('123456')));
    await waitFor(() => expect(sessionStorage.getItem('polity_onboarding')).toBe('true'));
    sessionStorage.clear();
    act(() => result.current.onCodePaste(pasteEvent('654321')));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledTimes(2));
    expect(sessionStorage.getItem('polity_onboarding')).toBeNull();
  });

  it('shows a verification error and falls back to translated copy when none is returned', async () => {
    mocks.verify
      .mockResolvedValueOnce({ success: false, isNewUser: false, error: 'expired' })
      .mockResolvedValueOnce({ success: false, isNewUser: false });
    const { result } = renderHook(() => useVerifyFormController());

    act(() => result.current.onCodePaste(pasteEvent('123456')));
    await waitFor(() => expect(result.current.displayError).toBe('expired'));
    act(() => result.current.onCodePaste(pasteEvent('654321')));
    await waitFor(() =>
      expect(result.current.displayError).toBe('features.auth.errors.verificationFailed')
    );
  });

  it('exposes verification and resend loading state', async () => {
    mocks.isVerifying = true;
    let resolveRequest!: (success: boolean) => void;
    mocks.requestMagicCode.mockReturnValue(
      new Promise<boolean>(resolve => {
        resolveRequest = resolve;
      })
    );
    const first = input();
    const { result } = renderHook(() => useVerifyFormController());
    act(() => result.current.setInputRef(0, first));

    act(() => result.current.onResendCode());
    expect(result.current.isVerifying).toBe(true);
    expect(result.current.isResending).toBe(true);
    expect(mocks.clearError).toHaveBeenCalled();
    expect(mocks.requestMagicCode).toHaveBeenCalledWith('person@example.test');

    await act(async () => resolveRequest(true));
    expect(result.current.isResending).toBe(false);
    expect(result.current.code).toEqual(['', '', '', '', '', '']);
    expect(first.focus).toHaveBeenCalled();
  });

  it('ends resend loading without resetting or focusing after a failed request', async () => {
    mocks.requestMagicCode.mockResolvedValue(false);
    const first = input();
    const { result } = renderHook(() => useVerifyFormController());
    act(() => result.current.setInputRef(0, first));
    act(() => result.current.onCodeChange(0, '1'));

    act(() => result.current.onResendCode());
    await waitFor(() => expect(result.current.isResending).toBe(false));
    expect(result.current.code[0]).toBe('1');
    expect(first.focus).not.toHaveBeenCalled();
  });
});
