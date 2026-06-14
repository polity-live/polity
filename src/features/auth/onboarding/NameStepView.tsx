import { ArrowRight, User } from 'lucide-react';

import { featureThemeClassName } from '@/features/shared/theme';
import { FormControlInput, FormControlLabel } from '@/features/shared/ui/form';
import { Button } from '@/features/shared/ui/ui/button.tsx';
import { cn } from '@/features/shared/utils/utils.ts';

interface NameStepViewProps {
  firstName: string;
  lastName: string;
  isLoading?: boolean;
  firstNameRequirementText: string;
  firstNameShowError: boolean;
  firstNameShowSuccess: boolean;
  isFormValid: boolean;
  labels: {
    continue: string;
    description: string;
    firstName: string;
    firstNamePlaceholder: string;
    lastName: string;
    lastNamePlaceholder: string;
    title: string;
  };
  lastNameRequirementText: string;
  lastNameShowError: boolean;
  lastNameShowSuccess: boolean;
  onFirstNameBlur: () => void;
  onFirstNameInputChange: (value: string) => void;
  onLastNameBlur: () => void;
  onLastNameInputChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}

export function NameStepView({
  firstName,
  lastName,
  isLoading,
  firstNameRequirementText,
  firstNameShowError,
  firstNameShowSuccess,
  isFormValid,
  labels,
  lastNameRequirementText,
  lastNameShowError,
  lastNameShowSuccess,
  onFirstNameBlur,
  onFirstNameInputChange,
  onLastNameBlur,
  onLastNameInputChange,
  onSubmit,
}: NameStepViewProps) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mb-4 flex justify-center">
          <div className={featureThemeClassName('authNameStepInfoAccentGradientSurface')}>
            <User className={featureThemeClassName('authGroupSearchStepContrastIcon')} />
          </div>
        </div>
        <h2 className="text-2xl font-bold">{labels.title}</h2>
        <p className="text-muted-foreground mt-2">{labels.description}</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <FormControlLabel htmlFor="firstName">{labels.firstName}</FormControlLabel>
          <FormControlInput
            id="firstName"
            type="text"
            placeholder={labels.firstNamePlaceholder}
            value={firstName}
            onChange={event => onFirstNameInputChange(event.target.value)}
            onBlur={onFirstNameBlur}
            disabled={isLoading}
            autoComplete="given-name"
            aria-invalid={firstNameShowError}
            data-valid={firstNameShowSuccess ? 'true' : undefined}
            autoFocus
          />
          <p
            className={cn(
              'text-muted-foreground text-xs',
              firstNameShowError && 'text-destructive',
              firstNameShowSuccess && featureThemeClassName('authNameStepSuccessText')
            )}
          >
            {firstNameRequirementText}
          </p>
        </div>

        <div className="space-y-2">
          <FormControlLabel htmlFor="lastName">{labels.lastName}</FormControlLabel>
          <FormControlInput
            id="lastName"
            type="text"
            placeholder={labels.lastNamePlaceholder}
            value={lastName}
            onChange={event => onLastNameInputChange(event.target.value)}
            onBlur={onLastNameBlur}
            disabled={isLoading}
            autoComplete="family-name"
            aria-invalid={lastNameShowError}
            data-valid={lastNameShowSuccess ? 'true' : undefined}
          />
          <p
            className={cn(
              'text-muted-foreground text-xs',
              lastNameShowError && 'text-destructive',
              lastNameShowSuccess && featureThemeClassName('authNameStepSuccessText')
            )}
          >
            {lastNameRequirementText}
          </p>
        </div>

        <Button type="submit" className="w-full" disabled={isLoading || !isFormValid}>
          {labels.continue}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
