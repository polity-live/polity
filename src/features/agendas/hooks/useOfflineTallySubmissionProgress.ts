import { useEffect, useState } from 'react';

import type { ActionSubmissionStep } from '@/features/shared/ui/action-submission';

function createSteps(activeIndex: number | null): ActionSubmissionStep[] {
  const baseSteps: ActionSubmissionStep[] = [
    {
      key: 'prepare',
      copy: { key: 'common.actionSubmission.steps.tally.prepare' },
      status: 'pending',
    },
    {
      key: 'commit',
      copy: { key: 'common.actionSubmission.steps.tally.commit' },
      status: 'pending',
    },
    {
      key: 'sync',
      copy: { key: 'common.actionSubmission.steps.tally.sync' },
      status: 'pending',
    },
  ];

  return baseSteps.map((step, index) => ({
    ...step,
    status:
      activeIndex == null
        ? 'pending'
        : index < activeIndex
          ? 'complete'
          : index === activeIndex
            ? 'active'
            : 'pending',
  }));
}

export function useOfflineTallySubmissionProgress(isSubmitting: boolean) {
  const [steps, setSteps] = useState<ActionSubmissionStep[]>(() => createSteps(null));

  useEffect(() => {
    if (!isSubmitting) {
      setSteps(createSteps(null));
      return;
    }

    setSteps(createSteps(0));

    const timers = [
      window.setTimeout(() => setSteps(createSteps(1)), 700),
      window.setTimeout(() => setSteps(createSteps(2)), 1700),
    ];

    return () => {
      timers.forEach(timer => window.clearTimeout(timer));
    };
  }, [isSubmitting]);

  return steps;
}
