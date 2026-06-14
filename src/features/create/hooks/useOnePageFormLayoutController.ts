import { useEffect, useRef, useState } from 'react';

import { useTranslation } from '@/features/shared/hooks/use-translation';

import type { CreateFormStep } from '../types/create-form.types';

interface UseOnePageFormLayoutControllerProps {
  steps: CreateFormStep[];
  onStepChange: (step: number) => void;
}

export function useOnePageFormLayoutController({
  steps,
  onStepChange,
}: UseOnePageFormLayoutControllerProps) {
  const { t } = useTranslation();
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activeSection, setActiveSection] = useState(0);
  const isScrollingRef = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (isScrollingRef.current) return;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const index = sectionRefs.current.indexOf(entry.target as HTMLDivElement);
            if (index !== -1) {
              setActiveSection(index);
              onStepChange(index);
            }
          }
        }
      },
      { threshold: 0.5 }
    );

    sectionRefs.current.forEach(ref => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, [steps.length, onStepChange]);

  const handleStepClick = (step: number) => {
    const el = sectionRefs.current[step];
    if (el) {
      isScrollingRef.current = true;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(step);
      onStepChange(step);
      setTimeout(() => {
        isScrollingRef.current = false;
      }, 500);
    }
  };

  return {
    activeSection,
    sectionRefs,
    stepLabels: steps.map(s => s.label),
    creatingLabel: t('pages.create.creating'),
    createButtonLabel: t('pages.create.summary.createButton'),
    onStepClick: handleStepClick,
  };
}
