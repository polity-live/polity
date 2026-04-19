'use client';

import { useState } from 'react';
import { Button } from '@/features/shared/ui/ui/button.tsx';
import { Input } from '@/features/shared/ui/ui/input.tsx';
import { Label } from '@/features/shared/ui/ui/label.tsx';
import { ArrowRight, User } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation.ts';
import { cn } from '@/features/shared/utils/utils.ts';

interface NameStepProps {
  firstName: string;
  lastName: string;
  onFirstNameChange: (value: string) => void;
  onLastNameChange: (value: string) => void;
  onNext: () => void;
  isLoading?: boolean;
}

export function NameStep({
  firstName,
  lastName,
  onFirstNameChange,
  onLastNameChange,
  onNext,
  isLoading,
}: NameStepProps) {
  const { t } = useTranslation();

  const [firstNameTouched, setFirstNameTouched] = useState(false);
  const [lastNameTouched, setLastNameTouched] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const trimmedFirstName = firstName.trim();
  const trimmedLastName = lastName.trim();
  const firstNameIsValid = trimmedFirstName.length >= 2 && trimmedFirstName.length <= 50;
  const lastNameIsValid = trimmedLastName.length >= 2 && trimmedLastName.length <= 50;
  const isFormValid = firstNameIsValid && lastNameIsValid;

  const firstNameShowError = (firstNameTouched || hasSubmitted) && !firstNameIsValid;
  const lastNameShowError = (lastNameTouched || hasSubmitted) && !lastNameIsValid;
  const firstNameShowSuccess = firstNameIsValid;
  const lastNameShowSuccess = lastNameIsValid;

  const getRequirementText = (value: string) => {
    const trimmedValue = value.trim();

    if (trimmedValue.length > 50) {
      return t('onboarding.nameStep.validation.tooLong');
    }

    return t('onboarding.nameStep.validation.tooShort');
  };

  const validate = (): boolean => {
    return isFormValid;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    setHasSubmitted(true);
    setFirstNameTouched(true);
    setLastNameTouched(true);

    if (validate()) {
      onNext();
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mb-4 flex justify-center">
          <div className="rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 p-4">
            <User className="h-8 w-8 text-white" />
          </div>
        </div>
        <h2 className="text-2xl font-bold">{t('onboarding.nameStep.title')}</h2>
        <p className="mt-2 text-muted-foreground">{t('onboarding.nameStep.description')}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">{t('onboarding.nameStep.firstName')}</Label>
          <Input
            id="firstName"
            type="text"
            placeholder={t('onboarding.nameStep.firstNamePlaceholder')}
            value={firstName}
            onChange={e => {
              onFirstNameChange(e.target.value);
              setFirstNameTouched(true);
            }}
            onBlur={() => setFirstNameTouched(true)}
            disabled={isLoading}
            autoComplete="given-name"
            aria-invalid={firstNameShowError}
            data-valid={firstNameShowSuccess ? 'true' : undefined}
            autoFocus
          />
          <p
            className={cn(
              'text-xs text-muted-foreground',
              firstNameShowError && 'text-destructive',
              firstNameShowSuccess && 'text-emerald-600 dark:text-emerald-400'
            )}
          >
            {getRequirementText(firstName)}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="lastName">{t('onboarding.nameStep.lastName')}</Label>
          <Input
            id="lastName"
            type="text"
            placeholder={t('onboarding.nameStep.lastNamePlaceholder')}
            value={lastName}
            onChange={e => {
              onLastNameChange(e.target.value);
              setLastNameTouched(true);
            }}
            onBlur={() => setLastNameTouched(true)}
            disabled={isLoading}
            autoComplete="family-name"
            aria-invalid={lastNameShowError}
            data-valid={lastNameShowSuccess ? 'true' : undefined}
          />
          <p
            className={cn(
              'text-xs text-muted-foreground',
              lastNameShowError && 'text-destructive',
              lastNameShowSuccess && 'text-emerald-600 dark:text-emerald-400'
            )}
          >
            {getRequirementText(lastName)}
          </p>
        </div>

        <Button type="submit" className="w-full" disabled={isLoading || !isFormValid}>
          {t('onboarding.nameStep.continue')}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
