import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { useElectionSearchInputController } from '../../hooks/useElectionSearchInputController';
import { ElectionSearchInputView } from './ElectionSearchInputView';

interface ElectionSearchInputProps {
  value: string;
  onChange: (electionId: string) => void;
  label?: string;
  hint?: string;
  placeholder?: string;
  required?: boolean;
}

export function ElectionSearchInput({
  value,
  onChange,
  label,
  hint,
  placeholder = translateText('generated.inline.0041_search_for_an_election_fce24966'),
  required,
}: ElectionSearchInputProps) {
  const { items, handleChange } = useElectionSearchInputController({ onChange });

  return (
    <ElectionSearchInputView
      items={items}
      value={value}
      onChange={handleChange}
      label={label}
      hint={hint}
      required={required}
      placeholder={placeholder}
    />
  );
}
