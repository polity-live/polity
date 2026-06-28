import { createElement, useEffect } from 'react';
import { toast } from 'sonner';

import { translate, useTranslation } from '@/features/shared/hooks/use-translation.ts';
import { AlphaWarningToastContent } from '../ui/AlphaWarningToastContent';

const ALPHA_WARNING_TOAST_ID = 'alpha-warning';
const ALPHA_WARNING_VERSION = '0.3';
const ALPHA_WARNING_ACKNOWLEDGED_VALUE = 'true';

const ALPHA_WARNING_SESSION_KEY = `polity.alphaWarning.${ALPHA_WARNING_VERSION}.acknowledged`;

let hasAcknowledgedAlphaWarningInMemory = false;

function hasAcknowledgedAlphaWarning() {
  if (hasAcknowledgedAlphaWarningInMemory) {
    return true;
  }

  if (typeof window === 'undefined') {
    return false;
  }

  try {
    return (
      window.sessionStorage.getItem(ALPHA_WARNING_SESSION_KEY) === ALPHA_WARNING_ACKNOWLEDGED_VALUE
    );
  } catch {
    return false;
  }
}

function acknowledgeAlphaWarning() {
  hasAcknowledgedAlphaWarningInMemory = true;

  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.setItem(ALPHA_WARNING_SESSION_KEY, ALPHA_WARNING_ACKNOWLEDGED_VALUE);
  } catch {
    // Keep the in-memory acknowledgement for environments where sessionStorage is unavailable.
  }
}

export function useAlphaWarningDialogController() {
  const { language } = useTranslation();

  useEffect(() => {
    if (hasAcknowledgedAlphaWarning()) {
      return;
    }

    toast.warning(
      createElement(AlphaWarningToastContent, {
        title: translate('common.alphaWarning.title'),
        version: ALPHA_WARNING_VERSION,
      }),
      {
        id: ALPHA_WARNING_TOAST_ID,
        description: translate('common.alphaWarning.description'),
        duration: Infinity,
        dismissible: false,
        closeButton: false,
        action: {
          label: translate('common.alphaWarning.confirm'),
          onClick: () => {
            acknowledgeAlphaWarning();
            toast.dismiss(ALPHA_WARNING_TOAST_ID);
          },
        },
      }
    );
  }, [language]);
}
