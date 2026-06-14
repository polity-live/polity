import { useMemo } from 'react';
import { toTypeaheadItems } from '@/features/shared/ui/typeahead/toTypeaheadItems';
import { useUserState } from '@/zero/users/useUserState';
import { CreateTypeaheadField } from '@/features/shared/ui/form';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

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
  placeholder = translateText('generated.inline.0044_search_users_by_name_or_handle_00f8d0a6'),
  excludeUserId,
  excludeUserIds = [],
  multi = true,
  required,
  disablePortal = false,
  showAllResults = false,
}: UserSearchInputProps) {
  const { allUsers } = useUserState({ includeAllUsers: true });

  const filteredUsers = useMemo(() => {
    const excludedIds = new Set(excludeUserIds);
    if (excludeUserId) {
      excludedIds.add(excludeUserId);
    }

    return (allUsers ?? []).filter(user => !excludedIds.has(user.id));
  }, [allUsers, excludeUserId, excludeUserIds]);

  const items = useMemo(
    () =>
      toTypeaheadItems(
        filteredUsers,
        'user',
        user => `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.handle || 'User',
        user => (user.handle ? `@${user.handle}` : user.email),
        user => user.avatar,
        user => `/user/${user.id}`
      ),
    [filteredUsers]
  );

  if (multi) {
    return (
      <CreateTypeaheadField
        items={items}
        multiple
        values={value}
        onValuesChange={onChange}
        label={label}
        hint={hint}
        required={required}
        placeholder={placeholder}
        disablePortal={disablePortal}
        showAllResults={showAllResults}
      />
    );
  }

  return (
    <CreateTypeaheadField
      items={items}
      value={value[0] || undefined}
      onChange={item => onChange(item ? [item.id] : [])}
      label={label}
      hint={hint}
      required={required}
      placeholder={placeholder}
      disablePortal={disablePortal}
      showAllResults={showAllResults}
    />
  );
}
