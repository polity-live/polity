import { X } from 'lucide-react';

import { Button } from '@/features/shared/ui/ui/button';
import { Panel } from '@/features/shared/ui/layout';

interface PWAInstallPromptViewProps {
  installTitle: string;
  installDescription: string;
  dismissLabel: string;
  notNowLabel: string;
  installLabel: string;
  onDismiss: () => void;
  onInstall: () => void | Promise<void>;
}

export function PWAInstallPromptView({
  installTitle,
  installDescription,
  dismissLabel,
  notNowLabel,
  installLabel,
  onDismiss,
  onInstall,
}: PWAInstallPromptViewProps) {
  return (
    <div className="fixed right-4 bottom-4 left-4 z-50 mx-auto max-w-md sm:left-auto">
      <Panel className="p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <h3 className="text-foreground font-semibold">{installTitle}</h3>
            <p className="text-muted-foreground mt-1 text-sm">{installDescription}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onDismiss}
            aria-label={dismissLabel}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onDismiss}>
            {notNowLabel}
          </Button>
          <Button type="button" className="flex-1" onClick={onInstall}>
            {installLabel}
          </Button>
        </div>
      </Panel>
    </div>
  );
}
