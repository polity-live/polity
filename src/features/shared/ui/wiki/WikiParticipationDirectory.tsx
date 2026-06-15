import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';

import type { ParticipationRoleLike } from '@/features/shared/types/participation';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { EntitySearchBar } from '@/features/shared/ui/typeahead';
import { ParticipationRoleFilterBar } from '@/features/shared/ui/participation';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Card, CardContent } from '@/features/shared/ui/ui/card';
import { RoleBadge } from '@/features/shared/ui/status';
import { getEntityToneClasses, type PrimaryEntityTone } from '@/features/shared/theme';
import { cn } from '@/features/shared/utils/utils';

export interface WikiParticipationRole extends ParticipationRoleLike {
  id: string;
  name: string;
}

export interface WikiParticipationItem {
  id: string;
  userId?: string | null;
  name: string;
  handle?: string | null;
  email?: string | null;
  avatar?: string | null;
  status?: string | null;
  roles?: readonly WikiParticipationRole[] | null;
  metadata?: readonly string[];
}

interface WikiUserLike {
  first_name?: string | null;
  last_name?: string | null;
  handle?: string | null;
  email?: string | null;
}

interface WikiRoleLike {
  id?: string | null;
  name?: string | null;
  title?: string | null;
  description?: string | null;
}

export interface WikiParticipationDirectoryProps {
  entityType?: PrimaryEntityTone;
  title: string;
  description?: string;
  items: readonly WikiParticipationItem[];
  roles?: readonly WikiParticipationRole[];
  searchPlaceholder?: string;
  emptyLabel?: string;
  noResultsLabel?: string;
  className?: string;
}

const VISIBLE_PARTICIPATION_STATUSES = new Set(['active', 'admin', 'confirmed', 'member', 'owner']);

export function isVisibleWikiParticipationStatus(status: string | null | undefined) {
  return VISIBLE_PARTICIPATION_STATUSES.has(status ?? '');
}

export function getWikiParticipationName(user: WikiUserLike | null | undefined) {
  return (
    [user?.first_name, user?.last_name].filter(Boolean).join(' ') ||
    user?.handle ||
    user?.email ||
    translateText('generated.inline.0031_unknown_bc7819b3')
  );
}

export function normalizeWikiParticipationRole(
  role: WikiRoleLike | null | undefined,
  fallbackName?: string
): WikiParticipationRole | null {
  if (!role?.id) {
    return null;
  }

  return {
    id: role.id,
    name:
      role.name ||
      role.title ||
      fallbackName ||
      translateText('components.membershipTables.roleFallback', 'Role'),
    description: role.description,
  };
}

function getSearchText(item: WikiParticipationItem) {
  return [
    item.name,
    item.handle,
    item.email,
    item.status,
    ...(item.metadata ?? []),
    ...(item.roles ?? []).map(role => role.name),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function getInitials(name: string) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('');

  return initials || 'U';
}

function dedupeRoles(roles: readonly WikiParticipationRole[]) {
  const byId = new Map<string, WikiParticipationRole>();

  roles.forEach(role => {
    if (!role.id || byId.has(role.id)) {
      return;
    }
    byId.set(role.id, role);
  });

  return [...byId.values()].sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
  );
}

export function WikiParticipationDirectory({
  entityType = 'user',
  title,
  description,
  items,
  roles = [],
  searchPlaceholder = translateText('common.actions.search', 'Search'),
  emptyLabel = translateText('components.empty.noResults', 'No results found.'),
  noResultsLabel = translateText('components.empty.noResults', 'No results found.'),
  className,
}: WikiParticipationDirectoryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const entityTone = getEntityToneClasses(entityType);
  const filterRoles = useMemo(() => dedupeRoles(roles), [roles]);
  const selectedRoleIdSet = useMemo(() => new Set(selectedRoleIds), [selectedRoleIds]);
  const normalizedSearch = searchQuery.trim().toLowerCase();

  const visibleItems = useMemo(
    () =>
      items.filter(item => {
        if (selectedRoleIds.length > 0) {
          const itemRoleIds = new Set((item.roles ?? []).map(role => role.id));
          const hasSelectedRole = [...selectedRoleIdSet].some(roleId => itemRoleIds.has(roleId));
          if (!hasSelectedRole) {
            return false;
          }
        }

        if (!normalizedSearch) {
          return true;
        }

        return getSearchText(item).includes(normalizedSearch);
      }),
    [items, normalizedSearch, selectedRoleIdSet, selectedRoleIds.length]
  );

  return (
    <section className={cn('mb-8 space-y-4', className)} data-slot="wiki-participation-directory">
      <div className="px-3 sm:px-4">
        <h2 className="text-xl font-semibold">{title}</h2>
        {description ? <p className="text-muted-foreground mt-1 text-sm">{description}</p> : null}
      </div>

      {items.length > 0 ? (
        <div className="space-y-3">
          <EntitySearchBar
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            placeholder={searchPlaceholder}
          />
          <ParticipationRoleFilterBar
            roles={filterRoles}
            selectedRoleIds={selectedRoleIds}
            onSelectedRoleIdsChange={setSelectedRoleIds}
            className="mb-0"
          />
        </div>
      ) : null}

      {visibleItems.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">
          {searchQuery || selectedRoleIds.length > 0 ? noResultsLabel : emptyLabel}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleItems.map((item, index) => {
            const card = (
              <Card interactive={item.userId ? 'lift' : 'default'} className="h-full">
                <CardContent className="flex h-full flex-col gap-4 p-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={item.avatar ?? undefined} />
                      <AvatarFallback>{getInitials(item.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{item.name}</p>
                      {item.handle ? (
                        <p className="text-muted-foreground truncate text-sm">@{item.handle}</p>
                      ) : item.email ? (
                        <p className="text-muted-foreground truncate text-sm">{item.email}</p>
                      ) : null}
                    </div>
                  </div>

                  {(item.roles?.length ?? 0) > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {item.roles?.map(role => (
                        <RoleBadge
                          key={role.id}
                          className={entityTone.badge}
                          data-role-key={role.id}
                        >
                          {role.name}
                        </RoleBadge>
                      ))}
                    </div>
                  ) : item.status ? (
                    <p className="text-muted-foreground text-sm">{item.status}</p>
                  ) : null}

                  {item.metadata?.length ? (
                    <div className="text-muted-foreground mt-auto flex flex-wrap gap-x-3 gap-y-1 text-xs">
                      {item.metadata.map(metadata => (
                        <span key={metadata}>{metadata}</span>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );

            return (
              <div
                key={item.id}
                className="civic-load-card-reveal"
                style={
                  {
                    '--civic-load-index': Math.min(index, 11),
                  } as CSSProperties
                }
              >
                {item.userId ? (
                  <Link
                    to="/user/$id"
                    params={{ id: item.userId }}
                    className="block h-full rounded-lg"
                  >
                    {card}
                  </Link>
                ) : (
                  card
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
