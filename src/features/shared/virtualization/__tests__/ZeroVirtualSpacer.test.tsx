/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ZeroVirtualSpacer } from '../ZeroVirtualSpacer';

afterEach(cleanup);

describe('ZeroVirtualSpacer', () => {
  it('renders a height-based, aria-hidden content spacer without margin', () => {
    const { container } = render(<ZeroVirtualSpacer position="before" size={51} />);

    const spacer = container.querySelector('[data-zero-virtual-spacer="before"]');
    expect(spacer?.getAttribute('aria-hidden')).toBe('true');
    expect((spacer as HTMLElement).style.height).toBe('51px');
    expect((spacer as HTMLElement).style.marginTop).toBe('0px');
  });

  it('does not render an empty spacer', () => {
    const { container } = render(<ZeroVirtualSpacer position="after" size={0} />);

    expect(container.firstChild).toBeNull();
  });
});
