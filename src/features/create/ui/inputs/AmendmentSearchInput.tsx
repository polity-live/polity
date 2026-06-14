import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface AmendmentSearchInputProps {
  value: string;
  onChange: (amendmentId: string) => void;
  label?: string;
  placeholder?: string;
}
import { useAmendmentSearchInputController } from './useAmendmentSearchInputController';
import { AmendmentSearchInputView } from './AmendmentSearchInputView';
export function AmendmentSearchInput({
  value,
  onChange,
  label,
  placeholder = translateText('generated.inline.0040_search_for_an_amendment_5231be40'),
}: AmendmentSearchInputProps) {
  const viewProps = useAmendmentSearchInputController({ value, onChange, label, placeholder });

  return <AmendmentSearchInputView {...viewProps} />;
}
