import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { useUserSearchInputController } from '../../hooks/useUserSearchInputController';
import { UserSearchInputView } from './UserSearchInputView';

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
  const { items } = useUserSearchInputController({ excludeUserId, excludeUserIds });

  return (
    <UserSearchInputView
      items={items}
      value={value}
      onChange={onChange}
      label={label}
      hint={hint}
      multi={multi}
      required={required}
      placeholder={placeholder}
      disablePortal={disablePortal}
      showAllResults={showAllResults}
    />
  );
}
