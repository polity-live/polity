import type { CreateFormStep } from '../types/create-form.types';

interface CreateStepRendererProps {
  step: CreateFormStep;
}

export function useCreateStepRendererController({ step }: CreateStepRendererProps) {
  return { step };
}
