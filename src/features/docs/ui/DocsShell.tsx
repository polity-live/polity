import { type ReactNode, useState } from 'react';
import { BookOpen, Menu } from 'lucide-react';
import { Link } from '@tanstack/react-router';

import { useTranslation } from '@/features/shared/hooks/use-translation';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/features/shared/ui/ui/sheet';
import { DocsSearchProvider, DocsSearchTrigger } from './DocsSearch';
import { DocsSidebar } from './DocsSidebar';

export function DocsShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  return (
    <DocsSearchProvider>
      <div className="bg-background flex min-h-[100dvh] border-t">
        <aside className="bg-card/45 hidden h-[100dvh] w-72 shrink-0 overflow-y-auto border-r px-4 py-6 lg:sticky lg:top-0 lg:block">
          <Link
            to="/docs"
            data-action-id="docs.shell.home.open"
            className="mb-6 flex items-center gap-2 px-3 text-lg font-semibold"
          >
            <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md">
              <BookOpen className="size-4" />
            </span>
            {t('pages.docs.hub.sidebarTitle')}
          </Link>
          <DocsSidebar />
        </aside>

        <div className="min-w-0 flex-1">
          <header className="bg-background/92 sticky top-[var(--app-shell-mobile-top-offset,0rem)] z-30 flex h-16 items-center gap-3 border-b px-4 backdrop-blur-md md:px-6">
            <Button
              data-action-id="docs.shell.mobile-navigation.open"
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setMobileNavigationOpen(true)}
              className="lg:hidden"
              aria-label={t('pages.docs.hub.openNavigation')}
            >
              <Menu className="size-4" />
            </Button>
            <Link
              to="/docs"
              data-action-id="docs.shell.home.open"
              className="font-semibold lg:hidden"
            >
              Docs
            </Link>
            <DocsSearchTrigger
              data-action-id="docs.shell.search.open"
              className="ml-auto max-w-xl lg:ml-0"
            />
          </header>

          {children}
        </div>
      </div>

      <Sheet open={mobileNavigationOpen} onOpenChange={setMobileNavigationOpen}>
        <SheetContent side="left" className="w-[min(90vw,23rem)] overflow-y-auto p-4">
          <SheetHeader className="mb-5 pr-8 text-left">
            <SheetTitle>{t('pages.docs.hub.sidebarTitle')}</SheetTitle>
            <SheetDescription>{t('pages.docs.overview.subtitle')}</SheetDescription>
          </SheetHeader>
          <DocsSidebar onNavigate={() => setMobileNavigationOpen(false)} />
        </SheetContent>
      </Sheet>
    </DocsSearchProvider>
  );
}
