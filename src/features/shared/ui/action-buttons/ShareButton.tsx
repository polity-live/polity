'use client';

import { type ReactNode } from 'react';
import { compactActionButtonClassName } from '@/features/shared/ui/layout/ActionBar';
import { cn } from '@/features/shared/utils/utils';
interface ShareButtonProps {
  url: string;
  title: string;
  description?: string;
  shareContextItem?: unknown;
  renderConversationDialog?: (props: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    shareUrl: string;
    shareTitle: string;
    shareDescription?: string;
    shareContextItem?: unknown;
  }) => ReactNode;
  internalShareLabel?: ReactNode;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  compactOnMobile?: boolean;
}
import { useShareButtonController } from './useShareButtonController';
import { ShareButtonView } from './ShareButtonView';

export function ShareButton({
  url,
  title,
  description,
  shareContextItem,
  renderConversationDialog,
  internalShareLabel,
  variant = 'outline',
  size = 'default',
  className = '',
  compactOnMobile = false,
}: ShareButtonProps) {
  const viewProps = useShareButtonController({
    url,
    title,
    description,
    shareContextItem,
    renderConversationDialog,
    internalShareLabel,
    variant,
    size,
    className: cn(compactOnMobile && compactActionButtonClassName, className),
  });

  return <ShareButtonView {...viewProps} compactOnMobile={compactOnMobile} />;
}
