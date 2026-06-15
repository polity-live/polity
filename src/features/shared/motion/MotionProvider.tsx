'use client';

import type { ReactNode } from 'react';
import { MotionConfig } from 'motion/react';

import { motionEasings, motionTimings } from './variants';

export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig
      reducedMotion="user"
      transition={{
        duration: motionTimings.base,
        ease: motionEasings.standard,
      }}
    >
      {children}
    </MotionConfig>
  );
}
