/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AccountEmailSectionView } from '../AccountEmailSectionView';
import { AccountPasswordSectionView } from '../AccountPasswordSectionView';
import { CurrentPasswordConfirmationDialog } from '../CurrentPasswordConfirmationDialog';
import { VotingPasswordTabView } from '../VotingPasswordTabView';

vi.mock('@/features/shared/ui/form', () => ({
  FormButton: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  FormControlInput: (props: any) => <input {...props} />,
  FormControlLabel: ({ children }: { children: ReactNode }) => <label>{children}</label>,
  FormFieldShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  InlineNotice: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PasswordField: (props: any) => <input value={props.value} onChange={props.onChange} />,
  SettingsPanel: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  TextField: (props: any) => <input value={props.value} onChange={props.onChange} />,
}));
vi.mock('@/features/shared/ui/dialog', () => ({
  ScrollableDialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui/dialog', () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
  DialogHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(cleanup);

const copy = new Proxy<Record<string, string>>({}, { get: (_, key) => String(key) });
const noop = () => undefined;

describe('account security view action contracts', () => {
  it('submits email, account-password, and voting-password forms through stable intents', () => {
    const onEmailSubmit = vi.fn((event: Event) => event.preventDefault());
    const onPasswordSubmit = vi.fn((event: Event) => event.preventDefault());
    const onVotingSubmit = vi.fn((event: Event) => event.preventDefault());
    const common = {
      isBusy: false,
      isValid: true,
      error: null,
      showPasswordError: false,
      showPasswordSuccess: true,
      showConfirmPasswordError: false,
      showConfirmPasswordSuccess: true,
      onPasswordChange: noop,
      onPasswordBlur: noop,
      onConfirmPasswordChange: noop,
      onConfirmPasswordBlur: noop,
    };

    const { rerender } = render(
      <AccountEmailSectionView
        {...({
          copy,
          currentEmailValue: 'old@example.test',
          newEmail: 'new@example.test',
          requiresInitialPassword: false,
          isBusy: false,
          isValid: true,
          error: null,
          showEmailError: false,
          showEmailSuccess: true,
          onSubmit: onEmailSubmit,
          onNewEmailChange: noop,
          onNewEmailBlur: noop,
        } as any)}
      />
    );
    fireEvent.submit(document.querySelector('[data-action-id="users.account.email.submit"]')!);
    expect(onEmailSubmit).toHaveBeenCalledOnce();

    rerender(
      <AccountPasswordSectionView
        {...({
          copy,
          password: 'long-password',
          confirmPassword: 'long-password',
          requiresInitialPassword: false,
          onSubmit: onPasswordSubmit,
          ...common,
        } as any)}
      />
    );
    fireEvent.submit(document.querySelector('[data-action-id="users.account.password.submit"]')!);
    expect(onPasswordSubmit).toHaveBeenCalledOnce();

    rerender(
      <VotingPasswordTabView
        {...({
          copy,
          hasVotingPassword: false,
          stateLoading: false,
          requiresInitialPassword: false,
          password: '123456',
          confirmPassword: '123456',
          onSubmit: onVotingSubmit,
          ...common,
        } as any)}
      />
    );
    fireEvent.submit(document.querySelector('[data-action-id="users.voting-password.submit"]')!);
    expect(onVotingSubmit).toHaveBeenCalledOnce();

    rerender(
      <VotingPasswordTabView
        {...({
          copy,
          hasVotingPassword: false,
          stateLoading: false,
          requiresInitialPassword: true,
          password: '',
          confirmPassword: '',
          onSubmit: onVotingSubmit,
          ...common,
        } as any)}
      />
    );
    expect(document.querySelector('[data-action-id="users.voting-password.submit"]')).toBeNull();
    expect(document.body.textContent).toContain('initialPasswordRequired');
  });

  it('confirms or cancels a protected account mutation through stable actions', () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <CurrentPasswordConfirmationDialog
        {...({
          open: true,
          onOpenChange,
          password: 'password',
          onPasswordChange: noop,
          onConfirm,
          isSubmitting: false,
          error: null,
          mode: 'password',
        } as any)}
      />
    );
    const form = document.querySelector(
      'form[data-action-id="users.security-confirmation.submit"]'
    )!;
    fireEvent.submit(form);
    fireEvent.click(
      document.querySelector('[data-action-id="users.security-confirmation.cancel"]')!
    );
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
