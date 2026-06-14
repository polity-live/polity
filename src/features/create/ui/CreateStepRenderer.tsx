import type { CreateFormStep } from '../types/create-form.types';
interface CreateStepRendererProps {
  step: CreateFormStep;
}
import { useCreateStepRendererController } from './useCreateStepRendererController';
import { CreateStepRendererView } from './CreateStepRendererView';
export function CreateStepRenderer({ step }: CreateStepRendererProps) {
  const viewProps = useCreateStepRendererController({ step });

  return <CreateStepRendererView {...viewProps} />;
}
