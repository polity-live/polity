/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback }),
}));
vi.mock('@/features/shared/ui/status', () => ({
  StatusBadge: ({ children }: any) => <span>{children}</span>,
  getRightLabel: (_right: string, translate: any) => translate('unknown.key', undefined),
}));

import { membershipRightsAlignmentPanelInternals } from '../MembershipRightsAlignmentPanel';

afterEach(cleanup);

it('uses the translation key when a connected-right fallback is absent', () => {
  const Cell = membershipRightsAlignmentPanelInternals.ConnectedRightsCell;
  const { container } = render(
    <Cell row={{ connectedRights: [{ rightKey: 'unknown', paths: [] }] } as any} />
  );
  expect(container.textContent).toBe('unknown.key');
});
