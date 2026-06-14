import type { FormEvent } from 'react';
import { useState } from 'react';

interface UseAddLinkDialogControllerOptions {
  onSubmit: (data: { label: string; url: string }) => void;
}

export function useAddLinkDialogController({ onSubmit }: UseAddLinkDialogControllerOptions) {
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({ label, url });
    setLabel('');
    setUrl('');
  };

  return {
    label,
    url,
    onLabelChange: setLabel,
    onUrlChange: setUrl,
    onSubmit: handleSubmit,
  };
}
