/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  geoProps: undefined as Record<string, any> | undefined,
}));

vi.mock('@/features/shared/theme', () => ({
  featureThemeClassName: (key: string) => `theme-${key}`,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/ui/form', () => ({
  SettingsPanel: ({
    children,
    action,
    description,
  }: {
    children: ReactNode;
    action?: ReactNode;
    description?: ReactNode;
  }) => (
    <section>
      {description}
      {action}
      {children}
    </section>
  ),
  FormButton: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  PasswordField: ({
    label,
    value,
    onValueChange,
    onBlur,
    descriptionClassName: _descriptionClassName,
    invalid: _invalid,
    ...props
  }: any) => (
    <label>
      {label}
      <input
        aria-label={label}
        value={value}
        onChange={e => onValueChange(e.target.value)}
        onBlur={onBlur}
        {...props}
      />
    </label>
  ),
  TextField: ({
    label,
    value,
    onValueChange,
    onBlur,
    descriptionClassName: _descriptionClassName,
    invalid: _invalid,
    ...props
  }: any) => (
    <label>
      {label}
      <input
        aria-label={label}
        value={value}
        onChange={e => onValueChange(e.target.value)}
        onBlur={onBlur}
        {...props}
      />
      <button type="button" onClick={() => onValueChange('manual')}>{`invoke-${label}`}</button>
    </label>
  ),
  FormFieldShell: ({ id, label, children, invalid }: any) => (
    <label>
      {label}
      {children({ id, describedBy: `${id}-help`, invalid })}
    </label>
  ),
  FormControlInput: (props: any) => <input {...props} />,
  FormControlLabel: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}));
vi.mock('@/features/shared/ui/feedback', () => ({
  InlineNotice: ({ children }: { children: ReactNode }) => <div role="alert">{children}</div>,
  Spinner: () => <span>spinner</span>,
}));
vi.mock('@/features/shared/ui/dialog', () => ({
  ScrollableDialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui/dialog', () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock('@/features/shared/ui/ui/card', () => ({
  Card: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  CardHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  CardTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));
vi.mock('@/features/shared/ui/form/GeoAddressPicker', () => ({
  GeoAddressPicker: (props: Record<string, any>) => {
    mocks.geoProps = props;
    return <div>geo-picker</div>;
  },
}));
vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

import { AccountEmailSectionView } from '../AccountEmailSectionView';
import { AccountPasswordSectionView } from '../AccountPasswordSectionView';
import { CurrentPasswordConfirmationDialog } from '../CurrentPasswordConfirmationDialog';
import { LocationInformationSection } from '../LocationInformationSection';
import { StatsItem } from '../StatsItem';
import { VotingPasswordTabView } from '../VotingPasswordTabView';

const copy = {
  title: 'title',
  description: 'description',
  set: 'set',
  notSet: 'notSet',
  initialPasswordRequired: 'initialPasswordRequired',
  newPassword: 'newPassword',
  setPassword: 'setPassword',
  confirmPassword: 'confirmPassword',
  passwordHint: 'passwordHint',
  confirmPasswordHint: 'confirmPasswordHint',
  update: 'update',
  save: 'save',
  initialDescription: 'initialDescription',
  newPasswordPlaceholder: 'newPasswordPlaceholder',
  confirmPasswordPlaceholder: 'confirmPasswordPlaceholder',
  initialHelp: 'initialHelp',
  updating: 'updating',
  setInitialPassword: 'setInitialPassword',
  currentEmail: 'currentEmail',
  newEmail: 'newEmail',
  newEmailPlaceholder: 'newEmailPlaceholder',
  emailHint: 'emailHint',
};

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('account view branches A07', () => {
  it('renders stat units and follower animation success/danger alternatives', () => {
    const view = render(<StatsItem label="Posts" value={4} />);
    expect(screen.getByText('4')).toBeTruthy();
    view.rerender(
      <StatsItem label="Followers" value={5} unit="k" showAnimation animationText="+1" />
    );
    expect(screen.getByText('5k').className).toContain('animate-flash-green');
    expect(screen.getByText('+1').className).toContain('SuccessText');
    view.rerender(<StatsItem label="Followers" value={3} showAnimation animationText="-2" />);
    expect(screen.getByText('3').className).toContain('animate-flash-red');
    expect(screen.getByText('-2').className).toContain('DangerText');
    view.rerender(<StatsItem label="Followers" value={3} showAnimation={false} />);
    expect(screen.queryByText('-2')).toBeNull();
  });

  it('covers voting-password loading, initial, valid, error and busy states', () => {
    const handlers = {
      onSubmit: vi.fn(e => e.preventDefault()),
      onPasswordChange: vi.fn(),
      onPasswordBlur: vi.fn(),
      onConfirmPasswordChange: vi.fn(),
      onConfirmPasswordBlur: vi.fn(),
    };
    const base = {
      copy,
      hasVotingPassword: false,
      stateLoading: true,
      requiresInitialPassword: true,
      password: '',
      confirmPassword: '',
      isBusy: false,
      isValid: false,
      error: null,
      showPasswordError: false,
      showPasswordSuccess: false,
      showConfirmPasswordError: false,
      showConfirmPasswordSuccess: false,
      ...handlers,
    };
    const view = render(<VotingPasswordTabView {...base} />);
    expect(screen.getByText('initialPasswordRequired')).toBeTruthy();
    expect(screen.queryByText('notSet')).toBeNull();

    view.rerender(
      <VotingPasswordTabView
        {...base}
        stateLoading={false}
        requiresInitialPassword={false}
        error="bad"
        showPasswordError
        showConfirmPasswordError
      />
    );
    expect(screen.getByText('notSet')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('bad');
    fireEvent.change(screen.getByLabelText('setPassword'), { target: { value: '1234' } });
    fireEvent.blur(screen.getByLabelText('setPassword'));
    fireEvent.change(screen.getByLabelText('confirmPassword'), { target: { value: '1234' } });
    fireEvent.blur(screen.getByLabelText('confirmPassword'));
    expect(handlers.onPasswordChange).toHaveBeenCalledWith('1234');

    view.rerender(
      <VotingPasswordTabView
        {...base}
        stateLoading={false}
        requiresInitialPassword={false}
        hasVotingPassword
        isBusy
        isValid
        showPasswordSuccess
        showConfirmPasswordSuccess
        password="1234"
        confirmPassword="1234"
      />
    );
    expect(screen.getByText('set')).toBeTruthy();
    expect(screen.getByText('spinner')).toBeTruthy();
    expect(screen.getByText('update')).toBeTruthy();
  });

  it('covers account password validation and initial/update busy labels', () => {
    const handlers = {
      onSubmit: vi.fn(e => e.preventDefault()),
      onPasswordChange: vi.fn(),
      onPasswordBlur: vi.fn(),
      onConfirmPasswordChange: vi.fn(),
      onConfirmPasswordBlur: vi.fn(),
    };
    const base = {
      copy,
      password: '',
      confirmPassword: '',
      requiresInitialPassword: false,
      isBusy: false,
      isValid: false,
      error: null,
      showPasswordError: false,
      showPasswordSuccess: false,
      showConfirmPasswordError: false,
      showConfirmPasswordSuccess: false,
      ...handlers,
    };
    const view = render(<AccountPasswordSectionView {...base} />);
    expect(screen.getByText('description')).toBeTruthy();
    expect(screen.getByText('update')).toBeTruthy();
    view.rerender(
      <AccountPasswordSectionView
        {...base}
        requiresInitialPassword
        isValid
        showPasswordError
        showPasswordSuccess
        showConfirmPasswordError
        showConfirmPasswordSuccess
        error="failure"
      />
    );
    expect(screen.getByText('initialDescription')).toBeTruthy();
    expect(screen.getByText('initialHelp')).toBeTruthy();
    expect(screen.getByText('setInitialPassword')).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
    view.rerender(<AccountPasswordSectionView {...base} isBusy isValid />);
    expect(screen.getByText('spinner')).toBeTruthy();
    expect(screen.getByText('updating')).toBeTruthy();
  });

  it('covers email initial-password, success/error and busy alternatives', () => {
    const onNewEmailChange = vi.fn();
    const base = {
      copy,
      currentEmailValue: 'old@example.test',
      newEmail: '',
      requiresInitialPassword: false,
      isBusy: false,
      isValid: false,
      error: null,
      showEmailError: false,
      showEmailSuccess: false,
      onSubmit: vi.fn(e => e.preventDefault()),
      onNewEmailChange,
      onNewEmailBlur: vi.fn(),
    };
    const view = render(<AccountEmailSectionView {...base} />);
    expect(screen.getByText('update')).toBeTruthy();
    fireEvent.click(screen.getByText('invoke-currentEmail'));
    view.rerender(
      <AccountEmailSectionView
        {...base}
        requiresInitialPassword
        error="bad"
        showEmailError
        showEmailSuccess
      />
    );
    expect(screen.getByText('initialPasswordRequired')).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('newEmail'), { target: { value: 'new@example.test' } });
    expect(onNewEmailChange).toHaveBeenCalledWith('new@example.test');
    view.rerender(<AccountEmailSectionView {...base} isBusy isValid />);
    expect(screen.getByText('spinner')).toBeTruthy();
    expect(screen.getByText('updating')).toBeTruthy();
  });

  it('covers password and code confirmation modes, defaults, filtering, cancel and submit', async () => {
    const onOpenChange = vi.fn();
    const onPasswordChange = vi.fn();
    const onConfirm = vi.fn();
    const base = {
      open: true,
      isSubmitting: false,
      password: '',
      onOpenChange,
      onPasswordChange,
      onConfirm,
    };
    const view = render(<CurrentPasswordConfirmationDialog {...base} />);
    expect(screen.getByText('pages.user.securityConfirmation.title')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('pages.user.securityConfirmation.currentPassword'), {
      target: { value: 'secret' },
    });
    expect(onPasswordChange).toHaveBeenCalledWith('secret');
    fireEvent.click(screen.getByText('common.actions.cancel'));
    expect(onOpenChange).toHaveBeenCalledWith(false);

    const onCodeChange = vi.fn();
    view.rerender(
      <CurrentPasswordConfirmationDialog
        {...base}
        mode="code"
        code="123456"
        error="wrong"
        onCodeChange={onCodeChange}
      />
    );
    fireEvent.change(screen.getByLabelText('pages.user.securityConfirmation.codeLabel'), {
      target: { value: '12a34567' },
    });
    expect(onCodeChange).toHaveBeenCalledWith('123456');
    fireEvent.submit(document.querySelector('form')!);
    expect(onConfirm).toHaveBeenCalled();
    expect(screen.getByText('wrong')).toBeTruthy();

    view.rerender(<CurrentPasswordConfirmationDialog {...base} mode="code" isSubmitting />);
    fireEvent.change(screen.getByLabelText('pages.user.securityConfirmation.codeLabel'), {
      target: { value: '123' },
    });
    expect(screen.getByText('pages.user.securityConfirmation.confirming')).toBeTruthy();
  });

  it('forwards coordinates and every address-field handler', () => {
    const handlers = {
      onCountryChange: vi.fn(),
      onRegionChange: vi.fn(),
      onPostCodeChange: vi.fn(),
      onCityChange: vi.fn(),
      onStreetChange: vi.fn(),
      onHouseNumberChange: vi.fn(),
      onCoordinatesChange: vi.fn(),
      onShapeChange: vi.fn(),
    };
    const base = {
      country: 'DE',
      region: 'BE',
      post_code: '1',
      city: 'Berlin',
      street: 'Main',
      house_number: '1',
      latitude: 52,
      longitude: 13,
      shape: null,
      ...handlers,
    };
    const view = render(<LocationInformationSection {...base} />);
    expect(mocks.geoProps?.coordinates).toEqual({ latitude: 52, longitude: 13 });
    for (const [field, value, handler] of [
      ['country', 'FR', handlers.onCountryChange],
      ['region', 'IDF', handlers.onRegionChange],
      ['city', 'Paris', handlers.onCityChange],
      ['post_code', '2', handlers.onPostCodeChange],
      ['street', 'Rue', handlers.onStreetChange],
      ['house_number', '3', handlers.onHouseNumberChange],
    ] as const) {
      mocks.geoProps?.onFieldChange(field, value);
      expect(handler).toHaveBeenCalledWith(value);
    }
    mocks.geoProps?.onFieldChange('unknown', 'ignored');
    view.rerender(<LocationInformationSection {...base} latitude={null} />);
    expect(mocks.geoProps?.coordinates).toBeNull();
    view.rerender(<LocationInformationSection {...base} longitude={null} />);
    expect(mocks.geoProps?.coordinates).toBeNull();
  });
});
