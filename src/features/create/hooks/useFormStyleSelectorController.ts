import { usePreferenceState } from '@/zero/preferences/usePreferenceState';
import { usePreferenceActions } from '@/zero/preferences/usePreferenceActions';
import type { CreateFormStyle } from '@/zero/preferences/schema';

interface UseFormStyleSelectorControllerProps {
  value?: CreateFormStyle;
  onChange?: (style: CreateFormStyle) => void;
}

export function useFormStyleSelectorController({
  value,
  onChange,
}: UseFormStyleSelectorControllerProps) {
  const { createFormStyle } = usePreferenceState();
  const { updateFormStyle } = usePreferenceActions();
  const selectedFormStyle = value ?? createFormStyle;

  const handleStyleChange = (style: CreateFormStyle) => {
    if (onChange) {
      onChange(style);
      return;
    }

    updateFormStyle(style);
  };

  return { selectedFormStyle, handleStyleChange };
}
