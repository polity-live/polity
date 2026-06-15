import { useTranslation } from '@/features/shared/hooks/use-translation';
import { SectionProgressTopBar } from '@/features/shared/ui/navigation';

interface CreateProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
  stepLabels: string[];
  onStepClick?: (step: number) => void;
  /** Which steps are valid (clickable) — defaults to all steps up to current */
  validSteps?: boolean[];
  sticky?: boolean;
  className?: string;
}

export function CreateProgressIndicator({
  currentStep,
  totalSteps,
  stepLabels,
  onStepClick,
  validSteps,
  sticky = false,
  className,
}: CreateProgressIndicatorProps) {
  const { t } = useTranslation();
  const progressPercent = totalSteps > 0 ? ((currentStep + 1) / totalSteps) * 100 : 0;
  const items = Array.from({ length: totalSteps }, (_, index) => {
    const isCompleted = index < currentStep;
    const isClickable =
      onStepClick && (isCompleted || (validSteps ? validSteps[index] : index <= currentStep));

    return {
      id: String(index),
      label: stepLabels[index] ?? String(index + 1),
      completed: isCompleted,
      disabled: !isClickable,
    };
  });

  return (
    <SectionProgressTopBar
      activeId={String(currentStep)}
      className={className}
      countLabel={t('pages.create.progress.stepOf', {
        current: currentStep + 1,
        total: totalSteps,
      })}
      items={items}
      label={t('pages.create.progress.label')}
      onItemSelect={onStepClick ? id => onStepClick(Number(id)) : undefined}
      progressValue={progressPercent}
      sticky={sticky}
    />
  );
}
