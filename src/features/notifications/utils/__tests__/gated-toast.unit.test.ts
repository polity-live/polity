import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  message: vi.fn(),
  loading: vi.fn(),
  dismiss: vi.fn(),
  promise: vi.fn(),
}));

vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: mocks,
}));

import { gatedToast, setInAppNotificationsEnabled } from '../gated-toast';

describe('gatedToast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setInAppNotificationsEnabled(true);
  });

  it('gates informational toasts while always forwarding operational methods', () => {
    gatedToast.success('saved', { id: 'success' });
    gatedToast.info('info');
    gatedToast.warning('warning');
    expect(mocks.success).toHaveBeenCalledWith('saved', { id: 'success' });
    expect(mocks.info).toHaveBeenCalledWith('info', undefined);
    expect(mocks.warning).toHaveBeenCalledWith('warning', undefined);

    setInAppNotificationsEnabled(false);
    expect(gatedToast.success('hidden')).toBeUndefined();
    expect(gatedToast.info('hidden')).toBeUndefined();
    expect(gatedToast.warning('hidden')).toBeUndefined();
    expect(mocks.success).toHaveBeenCalledTimes(1);

    gatedToast.error('error');
    gatedToast.message('message');
    gatedToast.loading('loading');
    gatedToast.dismiss();
    gatedToast.dismiss('toast-id');
    expect(mocks.error).toHaveBeenCalledWith('error', undefined);
    expect(mocks.message).toHaveBeenCalledWith('message', undefined);
    expect(mocks.loading).toHaveBeenCalledWith('loading', undefined);
    expect(mocks.dismiss).toHaveBeenNthCalledWith(1, undefined);
    expect(mocks.dismiss).toHaveBeenNthCalledWith(2, 'toast-id');
    expect(gatedToast.promise).toBe(mocks.promise);
  });

  it('builds default and customized mutation finalization toasts', () => {
    gatedToast.finalizationSuccess('saved');
    const [successMessage, successOptions] = mocks.success.mock.calls[0]!;
    expect(successMessage.props['data-create-finalization-toast']).toBe('saved');
    expect(successMessage.props['data-mutation-finalization-toast']).toBe('success');
    expect(successOptions.className).toContain('border-success/60');
    expect(successOptions.icon.props['data-create-finalization-icon']).toBe('check');
    expect(successOptions.testId).toBe('mutation-finalization-success-toast');

    const icon = 'custom-icon';
    gatedToast.finalizationSuccess('custom', {
      className: 'custom-class',
      icon,
      testId: 'custom-success',
    });
    const customSuccess = mocks.success.mock.calls[1]![1];
    expect(customSuccess.className).toContain('custom-class');
    expect(customSuccess.icon).toBe(icon);
    expect(customSuccess.testId).toBe('custom-success');

    gatedToast.finalizationError('failed');
    const [errorMessage, errorOptions] = mocks.error.mock.calls[0]!;
    expect(errorMessage.props['data-create-finalization-toast']).toBe('failed');
    expect(errorMessage.props['data-mutation-finalization-toast']).toBe('error');
    expect(errorOptions.icon.props['data-create-finalization-icon']).toBe('error');
    expect(errorOptions.testId).toBe('mutation-finalization-error-toast');

    gatedToast.finalizationError('custom failed', { icon, testId: 'custom-error' });
    const customError = mocks.error.mock.calls[1]![1];
    expect(customError.icon).toBe(icon);
    expect(customError.testId).toBe('custom-error');
  });
});
