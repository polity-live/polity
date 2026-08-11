/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  visible: false,
  dismiss: vi.fn(),
  install: vi.fn(),
}));

vi.mock('@/features/shared/hooks/use-translation.ts', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../hooks/usePwaInstallPrompt', () => ({
  usePwaInstallPrompt: () => ({
    isVisible: mocks.visible,
    handleDismiss: mocks.dismiss,
    handleInstall: mocks.install,
  }),
}));

vi.mock('../ui/PWAInstallPromptView', () => ({
  PWAInstallPromptView: (props: Record<string, any>) => (
    <div>
      <span>{props.installTitle}</span>
      <button type="button" onClick={props.onDismiss}>
        dismiss
      </button>
      <button type="button" onClick={props.onInstall}>
        install
      </button>
    </div>
  ),
}));

import { PWAInstallPrompt } from '../ui/pwa-install-prompt';

afterEach(cleanup);

describe('PWAInstallPrompt', () => {
  it('stays absent until visible and forwards prompt actions', () => {
    mocks.visible = false;
    const { rerender } = render(<PWAInstallPrompt />);
    expect(document.body.textContent).not.toContain('common.pwa.installTitle');

    mocks.visible = true;
    rerender(<PWAInstallPrompt />);
    expect(screen.getByText('common.pwa.installTitle')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'dismiss' }));
    fireEvent.click(screen.getByRole('button', { name: 'install' }));
    expect(mocks.dismiss).toHaveBeenCalledOnce();
    expect(mocks.install).toHaveBeenCalledOnce();
  });
});
