import {
  createContext,
  type FormEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { BookOpen, CornerDownLeft, Search, X } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';

import { useTranslation } from '@/features/shared/hooks/use-translation';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/features/shared/ui/ui/command';
import { Button } from '@/features/shared/ui/ui/button';
import { cn } from '@/features/shared/utils/utils';
import { searchDocs } from '../logic/docsSearch';
import type { DocsSearchMatch } from '../types/docs.types';

interface DocsSearchContextValue {
  openSearch: (query?: string) => void;
}

const DocsSearchContext = createContext<DocsSearchContextValue | null>(null);

function routeParts(route: string): { hash?: string; path: string } {
  const [path, hash] = route.split('#');
  return { path, ...(hash ? { hash } : {}) };
}

export function DocsSearchProvider({ children }: { children: ReactNode }) {
  const { t, language } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const matches = useMemo(
    () => (query.trim() ? searchDocs({ language, query, limit: 12 }) : []),
    [language, query]
  );

  const openSearch = useCallback((initialQuery = '') => {
    setQuery(initialQuery);
    setOpen(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;
      if (event.key === '/' && !isTyping) {
        event.preventDefault();
        openSearch();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [openSearch]);

  const selectMatch = (match: DocsSearchMatch) => {
    const { path, hash } = routeParts(match.route);
    setOpen(false);
    void navigate({ to: path as never, ...(hash ? { hash } : {}) } as never);
  };

  const openAllResults = () => {
    setOpen(false);
    void navigate({ to: '/docs/search', search: { q: query.trim() } } as never);
  };

  return (
    <DocsSearchContext.Provider value={{ openSearch }}>
      {children}
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title={t('pages.docs.hub.searchTitle')}
        description={t('pages.docs.hub.searchDescription')}
        className="max-w-2xl"
      >
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder={t('pages.docs.hub.searchPlaceholder')}
          aria-label={t('pages.docs.hub.searchLabel')}
        />
        <CommandList className="max-h-[min(62dvh,34rem)]">
          {query.trim() ? (
            <CommandEmpty>
              <div className="space-y-1 px-5">
                <p className="font-medium">{t('pages.docs.hub.noResults')}</p>
                <p className="text-muted-foreground text-xs">{t('pages.docs.hub.noResultsHint')}</p>
              </div>
            </CommandEmpty>
          ) : (
            <div className="text-muted-foreground px-5 py-8 text-center text-sm">
              {t('pages.docs.hub.searchDescription')}
            </div>
          )}
          {matches.length > 0 && (
            <CommandGroup heading={t('pages.docs.hub.searchResults')}>
              {matches.map(match => (
                <CommandItem
                  data-action-id="docs.search.result.select"
                  key={`${match.page.slug}:${match.section?.id ?? 'page'}`}
                  value={`${match.page.title} ${match.section?.title ?? ''} ${match.excerpt}`}
                  onSelect={() => selectMatch(match)}
                  className="items-start py-3"
                >
                  <BookOpen className="mt-0.5 size-4" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {match.section?.title ?? match.page.title}
                    </span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {match.section ? match.page.title : match.page.description}
                    </span>
                  </span>
                  <CommandShortcut>
                    <CornerDownLeft className="size-3.5" />
                  </CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
        {query.trim() && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              className="w-full justify-between"
              data-action-id="docs.search.results.open-all"
              onClick={openAllResults}
            >
              <span>{t('pages.docs.hub.searchResults')}</span>
              <span className="text-muted-foreground text-xs">{query.trim()}</span>
            </Button>
          </div>
        )}
      </CommandDialog>
    </DocsSearchContext.Provider>
  );
}

export function useDocsSearch() {
  const context = useContext(DocsSearchContext);
  if (!context) throw new Error('useDocsSearch must be used within DocsSearchProvider');
  return context;
}

export function DocsSearchTrigger({
  'data-action-id': actionId,
  className,
  prominent = false,
}: {
  'data-action-id'?: string;
  className?: string;
  prominent?: boolean;
}) {
  const { t } = useTranslation();
  const { openSearch } = useDocsSearch();
  return (
    <button
      type="button"
      data-action-id={actionId}
      onClick={() => openSearch()}
      className={cn(
        'bg-card text-muted-foreground hover:border-ring hover:text-foreground focus-visible:ring-ring flex w-full items-center gap-3 rounded-lg border text-left shadow-sm transition focus-visible:ring-2 focus-visible:outline-none',
        prominent ? 'min-h-16 px-5 text-base shadow-md' : 'h-10 px-3 text-sm',
        className
      )}
      aria-label={t('pages.docs.hub.searchLabel')}
    >
      <Search className={cn('shrink-0', prominent ? 'size-5' : 'size-4')} />
      <span className="min-w-0 flex-1 truncate">{t('pages.docs.hub.searchPlaceholder')}</span>
      <kbd className="bg-muted text-muted-foreground hidden rounded border px-2 py-1 font-mono text-[11px] sm:inline">
        /
      </kbd>
    </button>
  );
}

export function DocsSearchField({
  initialQuery = '',
  onSearch,
}: {
  initialQuery?: string;
  onSearch?: (query: string) => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState(initialQuery);

  useEffect(() => setQuery(initialQuery), [initialQuery]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSearch?.(query.trim());
  };

  return (
    <form
      onSubmit={submit}
      role="search"
      className="relative"
      data-action-id="docs.search-field.submit"
    >
      <Search className="text-muted-foreground absolute top-1/2 left-4 size-5 -translate-y-1/2" />
      <input
        data-action-id="docs.search-field.query.change"
        value={query}
        onChange={event => {
          setQuery(event.target.value);
          onSearch?.(event.target.value);
        }}
        placeholder={t('pages.docs.hub.searchPlaceholder')}
        aria-label={t('pages.docs.hub.searchLabel')}
        className="bg-card border-input focus:border-ring focus:ring-ring h-14 w-full rounded-lg border pr-24 pl-12 text-base shadow-sm outline-none focus:ring-2"
      />
      {query && (
        <Button
          data-action-id="docs.search-field.clear"
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => {
            setQuery('');
            onSearch?.('');
          }}
          className="absolute top-1/2 right-2 -translate-y-1/2"
          aria-label={t('pages.docs.hub.clearSearch')}
        >
          <X className="size-4" />
        </Button>
      )}
    </form>
  );
}
