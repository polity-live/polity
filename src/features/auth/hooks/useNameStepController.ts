import { useState, type FormEvent } from 'react';

import { useTranslation } from '@/features/shared/hooks/use-translation.ts';

interface UseNameStepControllerProps {
  firstName: string;
  lastName: string;
  onFirstNameChange: (value: string) => void;
  onLastNameChange: (value: string) => void;
  onNext: () => void;
}

export function useNameStepController({
  firstName,
  lastName,
  onFirstNameChange,
  onLastNameChange,
  onNext,
}: UseNameStepControllerProps) {
  const { t } = useTranslation();

  const [firstNameTouched, setFirstNameTouched] = useState(false);
  const [lastNameTouched, setLastNameTouched] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const trimmedFirstName = firstName.trim();
  const trimmedLastName = lastName.trim();
  const firstNameIsValid = trimmedFirstName.length >= 2 && trimmedFirstName.length <= 50;
  const lastNameIsValid = trimmedLastName.length >= 2 && trimmedLastName.length <= 50;
  const isFormValid = firstNameIsValid && lastNameIsValid;

  const getRequirementText = (value: string) => {
    const trimmedValue = value.trim();
    return t(
      trimmedValue.length > 50
        ? 'onboarding.nameStep.validation.tooLong'
        : 'onboarding.nameStep.validation.tooShort'
    );
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    setHasSubmitted(true);
    setFirstNameTouched(true);
    setLastNameTouched(true);

    if (isFormValid) {
      onNext();
    }
  };

  return {
    firstNameRequirementText: getRequirementText(firstName),
    firstNameShowError: (firstNameTouched || hasSubmitted) && !firstNameIsValid,
    firstNameShowSuccess: firstNameIsValid,
    isFormValid,
    labels: {
      continue: t('onboarding.nameStep.continue'),
      description: t('onboarding.nameStep.description'),
      firstName: t('onboarding.nameStep.firstName'),
      firstNamePlaceholder: t('onboarding.nameStep.firstNamePlaceholder'),
      lastName: t('onboarding.nameStep.lastName'),
      lastNamePlaceholder: t('onboarding.nameStep.lastNamePlaceholder'),
      title: t('onboarding.nameStep.title'),
    },
    lastNameRequirementText: getRequirementText(lastName),
    lastNameShowError: (lastNameTouched || hasSubmitted) && !lastNameIsValid,
    lastNameShowSuccess: lastNameIsValid,
    onFirstNameBlur: () => setFirstNameTouched(true),
    onFirstNameInputChange: (value: string) => {
      onFirstNameChange(value);
      setFirstNameTouched(true);
    },
    onLastNameBlur: () => setLastNameTouched(true),
    onLastNameInputChange: (value: string) => {
      onLastNameChange(value);
      setLastNameTouched(true);
    },
    onSubmit: handleSubmit,
  };
}
