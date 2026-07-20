import type { FormEvent } from 'react';
import { useState } from 'react';

import { useAccountActions } from '@/features/auth/hooks/useAccountActions';
import { isValidPassword, passwordsMatch } from '@/features/auth/logic/authValidation';
import { useDebounce } from '@/features/shared/hooks/use-debounce';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useAuth } from '@/providers/auth-provider';
import type { AccountPasswordSectionCopy } from '../ui/AccountPasswordSectionView';

export function useAccountPasswordSectionController() {
  const { t } = useTranslation();
  const { user, authStateLoading } = useAuth();
  const { isUpdating, updateAccountPassword } = useAccountActions();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [confirmationMode, setConfirmationMode] = useState<'password' | 'code'>('password');
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmPasswordTouched, setConfirmPasswordTouched] = useState(false);

  const requiresInitialPassword = user?.hasPassword === false;
  const debouncedPassword = useDebounce(password);
  const debouncedConfirmPassword = useDebounce(confirmPassword);
  const passwordIsValid = isValidPassword(password);
  const passwordsAreMatching = passwordsMatch(password, confirmPassword);

  const isValid =
    password.length > 0 && confirmPassword.length > 0 && passwordIsValid && passwordsAreMatching;
  const showPasswordError =
    passwordTouched && debouncedPassword.length > 0 && !isValidPassword(debouncedPassword);
  const showPasswordSuccess =
    passwordTouched && debouncedPassword.length > 0 && isValidPassword(debouncedPassword);
  const showConfirmPasswordError =
    confirmPasswordTouched &&
    debouncedConfirmPassword.length > 0 &&
    !passwordsMatch(debouncedPassword, debouncedConfirmPassword);
  const showConfirmPasswordSuccess =
    confirmPasswordTouched && passwordsMatch(debouncedPassword, debouncedConfirmPassword);

  const resetForm = () => {
    setPassword('');
    setConfirmPassword('');
    setError(null);
    setPasswordTouched(false);
    setConfirmPasswordTouched(false);
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (isUpdating) {
      return;
    }

    setIsDialogOpen(open);

    if (!open) {
      setCurrentPassword('');
      setVerificationCode('');
      setConfirmationMode('password');
      setDialogError(null);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPasswordTouched(true);
    setConfirmPasswordTouched(true);

    if (!passwordIsValid) {
      setError(t('pages.user.accountPassword.tooShort'));
      return;
    }

    if (!passwordsAreMatching) {
      setError(t('pages.user.accountPassword.mismatch'));
      return;
    }

    if (requiresInitialPassword) {
      const result = await updateAccountPassword(password);
      if (result.verificationRequired) {
        setVerificationCode('');
        setConfirmationMode('code');
        setIsDialogOpen(true);
        return;
      }

      if (result.success) {
        resetForm();
        return;
      }

      setError(result.error ?? null);
      return;
    }

    setCurrentPassword('');
    setVerificationCode('');
    setConfirmationMode('password');
    setDialogError(null);
    setIsDialogOpen(true);
  };

  const handleConfirm = async () => {
    const result = await updateAccountPassword(
      password,
      currentPassword,
      confirmationMode === 'code' ? verificationCode : undefined
    );
    if (result.verificationRequired) {
      setVerificationCode('');
      setConfirmationMode('code');
      setDialogError(null);
      return;
    }

    if (result.success) {
      resetForm();
      handleDialogOpenChange(false);
      return;
    }

    setDialogError(result.error ?? null);
  };

  const copy: AccountPasswordSectionCopy = {
    title: t('pages.user.accountPassword.title'),
    description: t('pages.user.accountPassword.description'),
    initialDescription: t('pages.user.accountPassword.initialDescription'),
    newPassword: t('pages.user.accountPassword.newPassword'),
    newPasswordPlaceholder: t('pages.user.accountPassword.newPasswordPlaceholder'),
    passwordHint: t('auth.signUp.passwordHint'),
    confirmPassword: t('pages.user.accountPassword.confirmPassword'),
    confirmPasswordPlaceholder: t('pages.user.accountPassword.confirmPasswordPlaceholder'),
    confirmPasswordHint: t('auth.signUp.confirmPasswordHint'),
    initialHelp: t('pages.user.accountPassword.initialHelp'),
    update: t('pages.user.accountPassword.update'),
    updating: t('pages.user.accountPassword.updating'),
    setInitialPassword: t('pages.user.accountPassword.setInitialPassword'),
  };

  return {
    accountPasswordProps: {
      copy,
      password,
      confirmPassword,
      requiresInitialPassword,
      isBusy: isUpdating || authStateLoading,
      isValid,
      error,
      showPasswordError,
      showPasswordSuccess,
      showConfirmPasswordError,
      showConfirmPasswordSuccess,
      onSubmit: handleSubmit,
      onPasswordChange: (value: string) => {
        setPassword(value);
        setPasswordTouched(true);
        setError(null);
      },
      onPasswordBlur: () => setPasswordTouched(true),
      onConfirmPasswordChange: (value: string) => {
        setConfirmPassword(value);
        setConfirmPasswordTouched(true);
        setError(null);
      },
      onConfirmPasswordBlur: () => setConfirmPasswordTouched(true),
    },
    confirmationDialogProps: {
      open: isDialogOpen,
      isSubmitting: isUpdating,
      mode: confirmationMode,
      password: currentPassword,
      code: verificationCode,
      error: dialogError,
      onOpenChange: handleDialogOpenChange,
      onPasswordChange: (value: string) => {
        setCurrentPassword(value);
        setDialogError(null);
      },
      onCodeChange: (value: string) => {
        setVerificationCode(value);
        setDialogError(null);
      },
      onConfirm: handleConfirm,
    },
    requiresInitialPassword,
  };
}
