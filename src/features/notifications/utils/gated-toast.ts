/**
 * Gated toast wrapper that respects user notification preferences.
 *
 * - error() and validation toasts ALWAYS show (never gated)
 * - success(), info(), warning() are gated by the user's inAppNotifications delivery setting
 *
 * The settings cache is synced from React via useToastSettingsSync().
 */
import { toast as sonnerToast, type ExternalToast } from 'sonner';

let inAppEnabled = true;

/** Called by useToastSettingsSync to update the cached setting */
export function setInAppNotificationsEnabled(enabled: boolean) {
  inAppEnabled = enabled;
}

export const gatedToast = {
  /** Always shows — errors are never gated */
  error: (message: string | React.ReactNode, data?: ExternalToast) =>
    sonnerToast.error(message, data),

  /** Gated by inAppNotifications preference */
  success: (message: string | React.ReactNode, data?: ExternalToast) => {
    if (!inAppEnabled) return;
    return sonnerToast.success(message, data);
  },

  /** Gated by inAppNotifications preference */
  info: (message: string | React.ReactNode, data?: ExternalToast) => {
    if (!inAppEnabled) return;
    return sonnerToast.info(message, data);
  },

  /** Gated by inAppNotifications preference */
  warning: (message: string | React.ReactNode, data?: ExternalToast) => {
    if (!inAppEnabled) return;
    return sonnerToast.warning(message, data);
  },

  /** Always shows — raw toast, no gating */
  message: (message: string | React.ReactNode, data?: ExternalToast) =>
    sonnerToast.message(message, data),

  /** Always shows — loading state, no gating */
  loading: (message: string | React.ReactNode, data?: ExternalToast) =>
    sonnerToast.loading(message, data),

  /** Dismiss a toast by id */
  dismiss: (id?: string | number) => sonnerToast.dismiss(id),

  /** Promise-based toast — always shows */
  promise: sonnerToast.promise,
};
