/* @vitest-environment jsdom */

import type { PropsWithChildren } from 'react';
import isPropValid from '@emotion/is-prop-valid';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  config: undefined as Record<string, unknown> | undefined,
}));

vi.mock('motion/react', () => ({
  MotionConfig: ({ children, ...config }: PropsWithChildren<Record<string, unknown>>) => {
    mocks.config = config;
    return <>{children}</>;
  },
}));

import { MotionProvider } from '../MotionProvider';
import { motionEasings, motionTimings } from '../variants';

describe('MotionProvider', () => {
  it('preserves motion defaults and explicitly filters DOM props for Motion 13', () => {
    render(
      <MotionProvider>
        <span>content</span>
      </MotionProvider>
    );

    expect(screen.getByText('content')).toBeTruthy();
    expect(mocks.config).toEqual({
      isValidProp: isPropValid,
      reducedMotion: 'user',
      transition: {
        duration: motionTimings.base,
        ease: motionEasings.standard,
      },
    });
  });
});
