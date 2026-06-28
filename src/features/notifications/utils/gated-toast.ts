/**
 * Gated toast wrapper that respects user notification preferences.
 *
 * - error() and validation toasts ALWAYS show (never gated)
 * - success(), info(), warning() are gated by the user's inAppNotifications delivery setting
 *
 * The settings cache is synced from React via useToastSettingsSync().
 */
import { createElement, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { toast as sonnerToast, type ExternalToast } from '@/features/shared/ui/ui/sonner';

let inAppEnabled = true;

/** Called by useToastSettingsSync to update the cached setting */
export function setInAppNotificationsEnabled(enabled: boolean) {
  inAppEnabled = enabled;
}

function finalizationSuccessMessage(message: ReactNode) {
  return createElement('span', { 'data-create-finalization-toast': 'saved' }, message);
}

function finalizationSuccessIcon() {
  return createElement(
    'span',
    {
      'aria-hidden': true,
      className: 'inline-flex',
      'data-create-finalization-icon': 'check',
    },
    createElement(Check, { className: 'h-4 w-4' })
  );
}

function mergeClassName(...classNames: (string | undefined)[]) {
  return classNames.filter(Boolean).join(' ');
}

export const gatedToast = {
  /** Always shows — errors are never gated */
  error: (message: string | ReactNode, data?: ExternalToast) => sonnerToast.error(message, data),

  /** Gated by inAppNotifications preference */
  success: (message: string | ReactNode, data?: ExternalToast) => {
    if (!inAppEnabled) return;
    return sonnerToast.success(message, data);
  },

  /** Always shows because it completes an already-visible finalization toast */
  finalizationSuccess: (message: string | ReactNode, data?: ExternalToast) =>
    sonnerToast.success(finalizationSuccessMessage(message), {
      ...data,
      className: mergeClassName('border-success/60 bg-success/10 text-success', data?.className),
      icon: data?.icon ?? finalizationSuccessIcon(),
      richColors: true,
      testId: data?.testId ?? 'create-finalization-saved-toast',
    }),

  /** Gated by inAppNotifications preference */
  info: (message: string | ReactNode, data?: ExternalToast) => {
    if (!inAppEnabled) return;
    return sonnerToast.info(message, data);
  },

  /** Gated by inAppNotifications preference */
  warning: (message: string | ReactNode, data?: ExternalToast) => {
    if (!inAppEnabled) return;
    return sonnerToast.warning(message, data);
  },

  /** Always shows — raw toast, no gating */
  message: (message: string | ReactNode, data?: ExternalToast) =>
    sonnerToast.message(message, data),

  /** Always shows — loading state, no gating */
  loading: (message: string | ReactNode, data?: ExternalToast) =>
    sonnerToast.loading(message, data),

  /** Dismiss a toast by id */
  dismiss: (id?: string | number) => sonnerToast.dismiss(id),

  /** Promise-based toast — always shows */
  promise: sonnerToast.promise,
};
