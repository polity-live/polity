'use client';

import { useNameStepController } from '@/features/auth/hooks/useNameStepController';
import { NameStepView } from './NameStepView';

interface NameStepProps {
  firstName: string;
  lastName: string;
  onFirstNameChange: (value: string) => void;
  onLastNameChange: (value: string) => void;
  onNext: () => void;
  isLoading?: boolean;
}

export function NameStep(props: NameStepProps) {
  return <NameStepView {...props} {...useNameStepController(props)} />;
}
