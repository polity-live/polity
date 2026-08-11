/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { FacebookIcon, InstagramIcon, LinkedinIcon, TwitterIcon, YoutubeIcon } from '../BrandIcons';

afterEach(cleanup);

describe('brand icons', () => {
  it('uses default SVG sizing and stroke values', () => {
    const { container } = render(<FacebookIcon />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('24');
    expect(svg.getAttribute('stroke-width')).toBe('2');
  });

  it('scales absolute strokes for numeric sizes and preserves strokes otherwise', () => {
    const numeric = render(<InstagramIcon size={48} strokeWidth={2} absoluteStrokeWidth />);
    expect(numeric.container.querySelector('svg')?.getAttribute('stroke-width')).toBe('1');
    numeric.unmount();

    const stringSize = render(<LinkedinIcon size={'2rem' as never} absoluteStrokeWidth />);
    expect(stringSize.container.querySelector('svg')?.getAttribute('stroke-width')).toBe('2');
  });

  it('renders the remaining icon paths', () => {
    const { container } = render(
      <>
        <TwitterIcon color="red" />
        <YoutubeIcon />
      </>
    );
    expect(container.querySelectorAll('svg')).toHaveLength(2);
  });
});
