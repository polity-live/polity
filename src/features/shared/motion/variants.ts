import type { Variants } from 'motion/react';

export const motionTimings = {
  fast: 0.12,
  base: 0.18,
  slow: 0.28,
  emphasis: 0.36,
  success: 0.46,
} as const;

export const motionEasings = {
  standard: [0.2, 0, 0, 1],
  soft: [0.16, 1, 0.3, 1],
  springLike: [0.34, 1.56, 0.64, 1],
} as const;

export const pageEnter: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: motionTimings.slow, ease: motionEasings.soft },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: { duration: motionTimings.fast, ease: motionEasings.standard },
  },
};

export const pageExit = pageEnter;

export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.045,
      delayChildren: 0.035,
    },
  },
};

export const listItem: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: motionTimings.base, ease: motionEasings.soft },
  },
};

export const cardHover = {
  rest: { y: 0, scale: 1 },
  hover: {
    y: -2,
    scale: 1.002,
    transition: { duration: motionTimings.base, ease: motionEasings.soft },
  },
  tap: {
    y: 1,
    scale: 0.995,
    transition: { duration: motionTimings.fast, ease: motionEasings.standard },
  },
} satisfies Variants;

export const buttonTap = {
  tap: {
    y: 1,
    scale: 0.99,
    transition: { duration: motionTimings.fast, ease: motionEasings.standard },
  },
} satisfies Variants;

export const scrollReveal: Variants = {
  initial: { opacity: 0, y: 18 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: motionTimings.emphasis, ease: motionEasings.soft },
  },
};

export const successSettle: Variants = {
  initial: { opacity: 0, scale: 0.98, y: 8 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: motionTimings.success, ease: motionEasings.springLike },
  },
  exit: {
    opacity: 0,
    scale: 0.985,
    transition: { duration: motionTimings.base, ease: motionEasings.standard },
  },
};

export const choiceSelect: Variants = {
  rest: { scale: 1 },
  selected: {
    scale: [1, 1.018, 1],
    transition: { duration: motionTimings.emphasis, ease: motionEasings.soft },
  },
  tap: {
    scale: 0.992,
    transition: { duration: motionTimings.fast, ease: motionEasings.standard },
  },
};

export const ballotSubmit: Variants = {
  initial: { opacity: 0, y: -10, rotate: -1 },
  animate: {
    opacity: 1,
    y: 0,
    rotate: 0,
    transition: { duration: motionTimings.success, ease: motionEasings.soft },
  },
  exit: {
    opacity: 0,
    y: 12,
    scale: 0.96,
    transition: { duration: motionTimings.base, ease: motionEasings.standard },
  },
};

export const civicMotionVariants = {
  pageEnter,
  pageExit,
  staggerContainer,
  listItem,
  cardHover,
  buttonTap,
  scrollReveal,
  successSettle,
  choiceSelect,
  ballotSubmit,
} as const;
