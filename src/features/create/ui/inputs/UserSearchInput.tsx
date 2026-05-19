import { useState, useMemo } from 'react';
import { TypeaheadSearch } from '@/features/shared/ui/typeahead/TypeaheadSearch';
import { toTypeaheadItems } from '@/features/shared/ui/typeahead/toTypeaheadItems';
import type { TypeaheadItem } from '@/features/shared/logic/typeaheadHelpers';
import { useUserState } from '@/zero/users/useUserState';
import { Label } from '@/features/shared/ui/ui/label';
import { Badge } from '@/features/shared/ui/ui/badge';
import { Button } from '@/features/shared/ui/ui/button';
import { X } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';
import { CreateTypeaheadField } from '../CreateFields';

interface UserSearchInputProps {
  value: string[];
  onChange: (userIds: string[]) => void;
  label?: string;
  hint?: string;
  placeholder?: string;
  /** User ID to exclude (usually the current user) */
  excludeUserId?: string;
  excludeUserIds?: string[];
  /** Allow selecting multiple users */
  multi?: boolean;
  required?: boolean;
  disablePortal?: boolean;
  showAllResults?: boolean;
}

export function UserSearchInput({
  value,
  onChange,
  label,
  hint,
  placeholder = 'Search users by name or handle...',
  excludeUserId,
  excludeUserIds = [],
  multi = true,
  required,
  disablePortal = false,
  showAllResults = false,
}: UserSearchInputProps) {
  const { t } = useTranslation();
  const { allUsers } = useUserState({ includeAllUsers: true });
  const [singleValue, setSingleValue] = useState('');
  const [hasInteracted, setHasInteracted] = useState(false);

  const filteredUsers = useMemo(() => {
    let users = allUsers ?? [];
    const excludedIds = new Set(excludeUserIds);
    if (excludeUserId) {
      excludedIds.add(excludeUserId);
    }
    if (excludedIds.size > 0) {
      users = users.filter(u => !excludedIds.has(u.id));
    }
    if (multi) {
      users = users.filter(u => !value.includes(u.id));
    }
    return users;
  }, [allUsers, excludeUserId, excludeUserIds, value, multi]);

  const selectedUsers = useMemo(() => {
    if (!allUsers) return [];
    return value
      .map(id => allUsers.find(u => u.id === id))
      .filter((u): u is NonNullable<typeof u> => Boolean(u));
  }, [allUsers, value]);

  const items = useMemo(
    () =>
      toTypeaheadItems(
        filteredUsers,
        'user',
        u => `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'User',
        u => (u.handle ? `@${u.handle}` : u.email),
        u => u.avatar
      ),
    [filteredUsers]
  );

  const handleSelect = (userId: string) => {
    if (multi) {
      if (!value.includes(userId)) {
        onChange([...value, userId]);
      }
    } else {
      onChange([userId]);
      setSingleValue(userId);
    }
  };

  const handleRemove = (userId: string) => {
    setHasInteracted(true);
    onChange(value.filter(id => id !== userId));
  };

  const hasSelection = value.length > 0;
  const isInvalid = Boolean(required) && hasInteracted && !hasSelection;
  const isValid = hasSelection;
  const fallbackHint =
    hint ??
    (required
      ? t('pages.create.common.requiredHint', 'Required.')
      : t('pages.create.common.optionalHint', 'Optional.'));
  const hintText = isInvalid
    ? t('pages.create.common.requiredHint', 'Required.')
    : isValid && !hint
      ? t('pages.create.common.validHint', 'Looks good.')
      : fallbackHint;
  const typeaheadClassName = cn(
    isInvalid &&
      '[&_[data-slot=input]]:border-destructive [&_[data-slot=input]]:focus-visible:ring-destructive/20 dark:[&_[data-slot=input]]:focus-visible:ring-destructive/40',
    isValid &&
      '[&_[data-slot=input]]:border-emerald-500 dark:[&_[data-slot=input]]:border-emerald-400 [&_[data-slot=input]]:focus-visible:ring-emerald-500/20 dark:[&_[data-slot=input]]:focus-visible:ring-emerald-500/30'
  );
  const hintToneClass = isInvalid
    ? 'text-destructive'
    : isValid
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-muted-foreground';

  if (!multi) {
    return (
      <CreateTypeaheadField
        items={items}
        value={singleValue || value[0] || undefined}
        onChange={(item: TypeaheadItem | null) => {
          setHasInteracted(true);
          if (item) {
            handleSelect(item.id);
          } else {
            onChange([]);
            setSingleValue('');
          }
        }}
        label={label}
        hint={hint}
        required={required}
        placeholder={placeholder}
      />
    );
  }

  return (
    <div className="space-y-3">
      {label && (
        <Label className="mb-2 block">
          {label}
          {required ? <span className="text-destructive"> *</span> : null}
        </Label>
      )}
      <TypeaheadSearch
        items={items}
        value=""
        onChange={(item: TypeaheadItem | null) => {
          setHasInteracted(true);
          if (item) handleSelect(item.id);
        }}
        onInteract={() => setHasInteracted(true)}
        placeholder={placeholder}
        className={typeaheadClassName}
        disablePortal={disablePortal}
        showAllResults={showAllResults}
      />
      <p className={cn('text-xs', hintToneClass)}>{hintText}</p>

      {/* Selected users list */}
      {multi && selectedUsers.length > 0 && (
        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs">{selectedUsers.length} selected</Label>
          <div className="flex flex-wrap gap-2">
            {selectedUsers.map(user => (
              <Badge key={user.id} variant="secondary" className="gap-1 py-1">
                {user.first_name} {user.last_name}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0"
                  onClick={() => handleRemove(user.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
