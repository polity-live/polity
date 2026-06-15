import type { FormEvent } from 'react';
import { useState } from 'react';
import { useActionSubmission } from '@/features/shared/ui/action-submission';

interface UseAddLinkDialogControllerOptions {
  onSubmit: (data: { label: string; url: string }) => unknown | Promise<unknown>;
  onSuccess?: () => void;
}

export function useAddLinkDialogController({
  onSubmit,
  onSuccess,
}: UseAddLinkDialogControllerOptions) {
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const actionSubmission = useActionSubmission('link');

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void actionSubmission
      .runActionWithSubmission(async () => onSubmit({ label, url }), {
        onSuccess: () => {
          setLabel('');
          setUrl('');
          actionSubmission.reset();
          onSuccess?.();
        },
      })
      .catch(() => undefined);
  };

  return {
    actionSubmission,
    label,
    url,
    onLabelChange: setLabel,
    onUrlChange: setUrl,
    onSubmit: handleSubmit,
  };
}
