'use client';

import { type ReactNode } from 'react';
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
    className,
  });

  return <ShareButtonView {...viewProps} />;
}
