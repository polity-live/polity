/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ defaultOpen: null as any, viewProps: null as any }));
vi.mock('@/features/amendments/hooks/useAmendmentProcessDetailsPanelController', () => ({
  useAmendmentProcessDetailsPanelController: (value: boolean) => {
    mocks.defaultOpen = value;
    return { open: value, onOpenChange: vi.fn() };
  },
}));
vi.mock('../AmendmentProcessDetailsPanelView', () => ({
  AmendmentProcessDetailsPanelView: (props: any) => {
    mocks.viewProps = props;
    return <div />;
  },
}));
import { AmendmentProcessDetailsPanel } from '../AmendmentProcessDetailsPanel';

describe('AmendmentProcessDetailsPanel A04 branch accountability', () => {
  afterEach(cleanup);
  it('uses default-open true and forwards explicit false', () => {
    const { rerender } = render(<AmendmentProcessDetailsPanel amendment={{ id: 'a' }} />);
    expect(mocks.defaultOpen).toBe(true);
    rerender(<AmendmentProcessDetailsPanel amendment={{ id: 'a' }} defaultOpen={false} />);
    expect(mocks.defaultOpen).toBe(false);
  });
});
