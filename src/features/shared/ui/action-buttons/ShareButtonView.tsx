'use client';
import { Button } from '@/features/shared/ui/ui/button.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/features/shared/ui/ui/dropdown-menu.tsx';
import { Share2, Check, Copy, Send } from 'lucide-react';
import { Input } from '@/features/shared/ui/ui/input.tsx';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
export interface ShareButtonViewProps {
  url: any;
  title: any;
  description: any;
  shareContextItem: any;
  renderConversationDialog: any;
  internalShareLabel: any;
  variant: any;
  size: any;
  className: any;
  compactOnMobile?: boolean;
  actionId?: string;
  t: any;
  copied: any;
  setCopied: any;
  isOpen: any;
  setIsOpen: any;
  conversationDialogOpen: any;
  setConversationDialogOpen: any;
  fullUrl: any;
  encodedUrl: any;
  encodedTitle: any;
  sharePlatforms: any[];
  directSharePlatforms: any[];
  manualSharePlatforms: any[];
  handleCopyUrl: any;
  handleShare: any;
}

export function ShareButtonView({
  url,
  title,
  description,
  shareContextItem,
  renderConversationDialog,
  internalShareLabel,
  variant,
  size,
  className,
  compactOnMobile = false,
  actionId,
  t,
  copied,
  isOpen,
  setIsOpen,
  conversationDialogOpen,
  setConversationDialogOpen,
  fullUrl,
  directSharePlatforms,
  manualSharePlatforms,
  handleCopyUrl,
  handleShare,
}: ShareButtonViewProps) {
  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button data-action-id={actionId} variant={variant} size={size} className={className}>
            <Share2 className={compactOnMobile ? 'mr-0 h-4 w-4 sm:mr-2' : 'mr-2 h-4 w-4'} />
            {t('common.actions.share')}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-[70vh] w-[280px] overflow-y-auto">
          <div className="p-2">
            <div className="text-muted-foreground mb-2 text-xs font-medium">
              {t('common.labels.shareVia')}
            </div>

            {renderConversationDialog ? (
              <>
                <DropdownMenuItem
                  onClick={() => {
                    setConversationDialogOpen(true);
                    setIsOpen(false);
                  }}
                  className="cursor-pointer"
                >
                  <Send className="text-primary mr-2 h-4 w-4" />
                  <span>
                    {internalShareLabel ?? translateText('generated.inline.1101_polity_f147ffe2')}
                  </span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />
              </>
            ) : null}

            {directSharePlatforms.map((platform: any) => (
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

            {manualSharePlatforms.map((platform: any) => (
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

      {renderConversationDialog?.({
        open: conversationDialogOpen,
        onOpenChange: setConversationDialogOpen,
        shareUrl: url,
        shareTitle: title,
        shareDescription: description,
        shareContextItem,
      })}
    </>
  );
}
