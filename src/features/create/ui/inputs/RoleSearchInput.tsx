import { toTypeaheadItems } from '@/features/shared/ui/typeahead/toTypeaheadItems';
import { useRolesWithGroups } from '@/zero/events/useEventState';
import { useMemo } from 'react';
import type { TypeaheadItem } from '@/features/shared/logic/typeaheadHelpers';
import { CreateTypeaheadField } from '../CreateFields';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface RoleSearchInputProps {
  value: string;
  onChange: (roleId: string) => void;
  label?: string;
  hint?: string;
  placeholder?: string;
  /** Filter roles to only these groups */
  groupIds?: string[];
  /** Filter roles to this event's groups */
  eventId?: string;
  required?: boolean;
}

export function RoleSearchInput({
  value,
  onChange,
  label,
  hint,
  placeholder = translateText('generated.inline.0043_search_for_a_role_8a23a3a3'),
  groupIds,
  required,
}: RoleSearchInputProps) {
  const { roles } = useRolesWithGroups();

  const filteredRoles = useMemo(() => {
    if (!roles) return [];
    if (!groupIds || groupIds.length === 0) return roles;
    return roles.filter(role => role.group_id && groupIds.includes(role.group_id));
  }, [roles, groupIds]);

  const items = useMemo(
    () =>
      toTypeaheadItems(
        filteredRoles,
        'role',
        role => role.title || 'Role',
        role =>
          typeof role.description === 'string' ? role.description.substring(0, 60) : undefined
      ),
    [filteredRoles]
  );

  const handleChange = (item: TypeaheadItem | null) => {
    onChange(item?.id ?? '');
  };

  return (
    <CreateTypeaheadField
      items={items}
      value={value || undefined}
      onChange={handleChange}
      label={label}
      hint={hint}
      required={required}
      placeholder={placeholder}
    />
  );
}
