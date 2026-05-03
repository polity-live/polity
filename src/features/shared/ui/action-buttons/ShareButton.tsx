'use client';

import { useState } from 'react';
import { Button } from '@/features/shared/ui/ui/button.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/features/shared/ui/ui/dropdown-menu.tsx';
import {
  Share2,
  MessageSquare,
  Instagram,
  Facebook,
  Ghost,
  Linkedin,
  Music2,
  Twitter,
  type LucideIcon,
  Check,
  Copy,
  Send,
  Youtube,
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/features/shared/ui/ui/input.tsx';
import { ConversationSelectorDialog } from './ConversationSelectorDialog.tsx';
import { useTranslation } from '@/features/shared/hooks/use-translation.ts';
import type { SearchContentItem } from '@/features/search/types/search.types';

type SharePlatform =
  | {
      key: 'whatsapp' | 'twitter' | 'facebook' | 'linkedin';
      label: string;
      Icon: LucideIcon;
      iconClassName: string;
      href: string;
      manualOnly?: false;
    }
  | {
      key: 'instagram' | 'snapchat' | 'tiktok' | 'youtube';
      label: string;
      Icon: LucideIcon;
      iconClassName: string;
      manualOnly: true;
    };

interface ShareButtonProps {
  url: string;
  title: string;
  description?: string;
  shareContextItem?: SearchContentItem;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export function ShareButton({
  url,
  title,
  description,
  shareContextItem,
  variant = 'outline',
  size = 'default',
  className = '',
}: ShareButtonProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [conversationDialogOpen, setConversationDialogOpen] = useState(false);

  const fullUrl = typeof window !== 'undefined' ? window.location.origin + url : url;
  const encodedUrl = encodeURIComponent(fullUrl);
  const encodedTitle = encodeURIComponent(title);
  const sharePlatforms: SharePlatform[] = [
    {
      key: 'whatsapp',
      label: 'WhatsApp',
      Icon: MessageSquare,
      iconClassName: 'text-green-500',
      href: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
    },
    {
      key: 'twitter',
      label: 'X (Twitter)',
      Icon: Twitter,
      iconClassName: 'text-gray-800 dark:text-gray-300',
      href: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
    },
    {
      key: 'facebook',
      label: 'Facebook',
      Icon: Facebook,
      iconClassName: 'text-blue-600',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
    {
      key: 'linkedin',
      label: 'LinkedIn',
      Icon: Linkedin,
      iconClassName: 'text-sky-700',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    },
    {
      key: 'instagram',
      label: 'Instagram',
      Icon: Instagram,
      iconClassName: 'text-pink-500',
      manualOnly: true,
    },
    {
      key: 'snapchat',
      label: 'Snapchat',
      Icon: Ghost,
      iconClassName: 'text-yellow-400',
      manualOnly: true,
    },
    {
      key: 'tiktok',
      label: 'TikTok',
      Icon: Music2,
      iconClassName: 'text-zinc-900 dark:text-zinc-100',
      manualOnly: true,
    },
    {
      key: 'youtube',
      label: 'YouTube',
      Icon: Youtube,
      iconClassName: 'text-red-600',
      manualOnly: true,
    },
  ];
  const directSharePlatforms = sharePlatforms.filter(platform => !platform.manualOnly);
  const manualSharePlatforms = sharePlatforms.filter(platform => platform.manualOnly);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      toast.success(t('common.share.linkCopied'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('common.share.linkCopyFailed'));
    }
  };

  const handleShare = (platform: SharePlatform) => {
    if (platform.manualOnly) {
      toast.info(t('common.share.shareManually', { platform: platform.label }));
      setIsOpen(false);
      return;
    }
    window.open(platform.href, '_blank', 'noopener,noreferrer,width=600,height=400');
    setIsOpen(false);
  };

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant={variant} size={size} className={className}>
            <Share2 className="mr-2 h-4 w-4" />
            {t('common.actions.share')}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-[70vh] w-[280px] overflow-y-auto">
          <div className="p-2">
            <div className="text-muted-foreground mb-2 text-xs font-medium">
              {t('common.labels.shareVia')}
            </div>

            <DropdownMenuItem
              onClick={() => {
                setConversationDialogOpen(true);
                setIsOpen(false);
              }}
              className="cursor-pointer"
            >
              <Send className="text-primary mr-2 h-4 w-4" />
              <span>Polity</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {directSharePlatforms.map(platform => (
              <DropdownMenuItem
                key={platform.key}
                onClick={() => handleShare(platform)}
                className="cursor-pointer"
              >
                <platform.Icon className={`mr-2 h-4 w-4 ${platform.iconClassName}`} />
                <span>{platform.label}</span>
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />

            {manualSharePlatforms.map(platform => (
              <DropdownMenuItem
                key={platform.key}
                onClick={() => handleShare(platform)}
                className="cursor-pointer"
              >
                <platform.Icon className={`mr-2 h-4 w-4 ${platform.iconClassName}`} />
                <span>{platform.label}</span>
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />

            <div className="text-muted-foreground mt-2 mb-1 text-xs font-medium">
              {t('common.labels.copyLink')}
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={fullUrl}
                readOnly
                className="h-8 flex-1 text-xs"
                onClick={e => (e.target as HTMLInputElement).select()}
              />
              <Button size="sm" variant="ghost" className="h-8 px-2" onClick={handleCopyUrl}>
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConversationSelectorDialog
        open={conversationDialogOpen}
        onOpenChange={setConversationDialogOpen}
        shareUrl={url}
        shareTitle={title}
        shareDescription={description}
        shareContextItem={shareContextItem}
      />
    </>
  );
}
