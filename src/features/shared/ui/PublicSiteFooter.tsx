import { Link } from '@tanstack/react-router';
import { useTranslation } from '@/features/shared/hooks/use-translation';

const legalLinkKeys = [
  {
    key: 'privacy',
    to: '/privacy-policy' as const,
    labelKey: 'pages.privacy.title',
  },
  {
    key: 'terms',
    to: '/terms-and-conditions' as const,
    labelKey: 'pages.terms.title',
  },
  {
    key: 'imprint',
    to: '/imprint' as const,
    labelKey: 'pages.imprint.title',
  },
] as const;

export function PublicSiteFooter() {
  const { t } = useTranslation();

  return (
    <footer className="bg-muted/30 mt-auto border-t">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-md">
          <Link to="/" className="inline-flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-950 shadow-sm ring-1 ring-zinc-950/10">
              <img
                src="/apple-touch-icon.png"
                alt="Polity logo"
                width={36}
                height={36}
                className="h-9 w-9 rounded-xl"
              />
            </span>
            <span className="text-lg font-semibold tracking-tight">Polity</span>
          </Link>
          <p className="text-muted-foreground mt-3 text-sm leading-6">
            {t('pages.home.hero.subtitle')}
          </p>
        </div>

        <nav aria-label="Legal pages" className="flex flex-col gap-3 sm:items-end">
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium">
            {legalLinkKeys.map(link => (
              <Link
                key={link.key}
                to={link.to}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {t(link.labelKey)}
              </Link>
            ))}
          </div>
          <p className="text-muted-foreground text-xs">Polity</p>
        </nav>
      </div>
    </footer>
  );
}
