import type { FormEvent } from 'react';
import { useState } from 'react';

import { useAccountActions } from '@/features/auth/hooks/useAccountActions';
import { useDebounce } from '@/features/shared/hooks/use-debounce';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useAuth } from '@/providers/auth-provider';
import { useVotingPasswordActions } from '@/zero/voting-password/useVotingPasswordActions';
import { useVotingPasswordState } from '@/zero/voting-password/useVotingPasswordState';
import type { VotingPasswordTabCopy } from '../ui/VotingPasswordTabView';

interface UseVotingPasswordTabControllerOptions {
  userId: string;
}

const isValidVotingPassword = (value: string) => /^\d{4}$/.test(value);
const normalizeVotingPassword = (value: string) => value.replace(/\D/g, '').slice(0, 4);

export function useVotingPasswordTabController({ userId }: UseVotingPasswordTabControllerOptions) {
  const { t } = useTranslation();
  const { user, authStateLoading } = useAuth();
  const { setVotingPassword } = useVotingPasswordActions();
  const { verifyCurrentPassword } = useAccountActions();
  const { hasVotingPassword, isLoading: stateLoading } = useVotingPasswordState({ userId });

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmPasswordTouched, setConfirmPasswordTouched] = useState(false);

  const requiresInitialPassword = user?.hasPassword === false;
  const debouncedPassword = useDebounce(password);
  const debouncedConfirmPassword = useDebounce(confirmPassword);
  const passwordIsValid = isValidVotingPassword(password);
  const passwordsAreMatching =
    password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;

  const isValid = password.length === 4 && passwordIsValid && passwordsAreMatching;
  const showPasswordError =
    passwordTouched && debouncedPassword.length > 0 && !isValidVotingPassword(debouncedPassword);
  const showPasswordSuccess =
    passwordTouched && debouncedPassword.length > 0 && isValidVotingPassword(debouncedPassword);
  const showConfirmPasswordError =
    confirmPasswordTouched &&
    debouncedConfirmPassword.length > 0 &&
    !(
      debouncedPassword.length > 0 &&
      debouncedConfirmPassword.length > 0 &&
      debouncedPassword === debouncedConfirmPassword
    );
  const showConfirmPasswordSuccess =
    confirmPasswordTouched &&
    debouncedPassword.length > 0 &&
    debouncedConfirmPassword.length > 0 &&
    debouncedPassword === debouncedConfirmPassword;

  const resetForm = () => {
    setPassword('');
    setConfirmPassword('');
    setError(null);
    setPasswordTouched(false);
    setConfirmPasswordTouched(false);
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (isSubmitting) {
      return;
    }

    setIsDialogOpen(open);

    if (!open) {
      setCurrentPassword('');
      setDialogError(null);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPasswordTouched(true);
    setConfirmPasswordTouched(true);

    if (!passwordsAreMatching) {
      setError(t('pages.user.votingPassword.mismatch'));
      return;
    }

    if (!passwordIsValid) {
      setError(t('pages.user.votingPassword.invalidFormat'));
      return;
    }

    setCurrentPassword('');
    setDialogError(null);
    setIsDialogOpen(true);
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      const verificationResult = await verifyCurrentPassword(currentPassword);
      if (!verificationResult.success) {
        setDialogError(verificationResult.error ?? null);
        return;
      }

      await setVotingPassword(password);
      resetForm();
      handleDialogOpenChange(false);
    } catch (submitError) {
      setDialogError(
        submitError instanceof Error
          ? submitError.message
          : t('pages.user.votingPassword.saveFailed')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const copy: VotingPasswordTabCopy = {
    title: t('pages.user.votingPassword.title'),
    description: t('pages.user.votingPassword.description'),
    set: t('pages.user.votingPassword.set'),
    notSet: t('pages.user.votingPassword.notSet'),
    initialPasswordRequired: t('pages.user.votingPassword.initialPasswordRequired'),
    newPassword: t('pages.user.votingPassword.newPassword'),
    setPassword: t('pages.user.votingPassword.setPassword'),
    confirmPassword: t('pages.user.votingPassword.confirmPassword'),
    passwordHint: t('pages.user.votingPassword.passwordHint'),
    confirmPasswordHint: t('pages.user.votingPassword.confirmPasswordHint'),
    update: t('pages.user.votingPassword.update'),
    save: t('pages.user.votingPassword.save'),
  };

  return {
    votingPasswordProps: {
      copy,
      hasVotingPassword,
      stateLoading,
      requiresInitialPassword,
      password,
      confirmPassword,
      isBusy: isSubmitting || authStateLoading,
      isValid,
      error,
      showPasswordError,
      showPasswordSuccess,
      showConfirmPasswordError,
      showConfirmPasswordSuccess,
      onSubmit: handleSubmit,
      onPasswordChange: (value: string) => {
        setPassword(normalizeVotingPassword(value));
        setPasswordTouched(true);
        setError(null);
      },
      onPasswordBlur: () => setPasswordTouched(true),
      onConfirmPasswordChange: (value: string) => {
        setConfirmPassword(normalizeVotingPassword(value));
        setConfirmPasswordTouched(true);
        setError(null);
      },
      onConfirmPasswordBlur: () => setConfirmPasswordTouched(true),
    },
    confirmationDialogProps: {
      open: isDialogOpen,
      isSubmitting,
      password: currentPassword,
      error: dialogError,
      onOpenChange: handleDialogOpenChange,
      onPasswordChange: (value: string) => {
        setCurrentPassword(value);
        setDialogError(null);
      },
      onConfirm: handleConfirm,
    },
    requiresInitialPassword,
  };
}
