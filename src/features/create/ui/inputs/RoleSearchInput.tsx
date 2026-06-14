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

import { useRoleSearchInputController } from './useRoleSearchInputController';
import { RoleSearchInputView } from './RoleSearchInputView';

export function RoleSearchInput({
  value,
  onChange,
  label,
  hint,
  placeholder = translateText('generated.inline.0043_search_for_a_role_8a23a3a3'),
  groupIds,
  required,
}: RoleSearchInputProps) {
  const viewProps = useRoleSearchInputController({
    value,
    onChange,
    label,
    hint,
    placeholder,
    groupIds,
    required,
  });

  return <RoleSearchInputView {...viewProps} />;
}
