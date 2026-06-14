import { useState } from 'react';

export function useContactDialogController() {
  const [open, setOpen] = useState(false);

  return {
    open,
    onOpenChange: setOpen,
  };
}
