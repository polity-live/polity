'use client';

import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useRouterState } from '@tanstack/react-router';

import { cn } from '@/features/shared/utils/utils';
import { listItem, pageEnter, scrollReveal, staggerContainer, successSettle } from './variants';

type MotionDivProps = ComponentPropsWithoutRef<typeof motion.div>;

interface MotionPageProps extends Omit<MotionDivProps, 'variants'> {
  routeKey?: string;
  children: ReactNode;
}

export function MotionPage({ routeKey, className, children, ...props }: MotionPageProps) {
  const pathname = useRouterState({ select: state => state.location.pathname });
  const key = routeKey ?? pathname;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={key}
        variants={pageEnter}
        initial="initial"
        animate="animate"
        exit="exit"
        className={cn('min-w-0', className)}
        {...props}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export function MotionGroup({ className, ...props }: MotionDivProps) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className={className}
      {...props}
    />
  );
}

export function MotionItem({ className, ...props }: MotionDivProps) {
  return <motion.div variants={listItem} className={className} {...props} />;
}

interface ScrollRevealProps extends Omit<MotionDivProps, 'variants'> {
  amount?: number;
  once?: boolean;
  as?: 'div' | 'section';
}

export function ScrollReveal({
  amount = 0.2,
  once = true,
  as = 'div',
  className,
  ...props
}: ScrollRevealProps) {
  const Component = as === 'section' ? motion.section : motion.div;

  return (
    <Component
      variants={scrollReveal}
      initial="initial"
      whileInView="animate"
      viewport={{ once, amount }}
      className={className}
      {...props}
    />
  );
}

interface PresenceSwapProps {
  children: ReactNode;
  motionKey: string;
  className?: string;
}

export function PresenceSwap({ children, motionKey, className }: PresenceSwapProps) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={motionKey}
        variants={listItem}
        initial="initial"
        animate="animate"
        exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export function SuccessTransition({ className, ...props }: MotionDivProps) {
  return (
    <motion.div
      variants={successSettle}
      initial="initial"
      animate="animate"
      exit="exit"
      className={cn('civic-success-settle', className)}
      {...props}
    />
  );
}
