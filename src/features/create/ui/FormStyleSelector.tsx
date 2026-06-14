import type { CreateFormStyle } from '@/zero/preferences/schema';
import { useFormStyleSelectorController } from '../hooks/useFormStyleSelectorController';
import { FormStyleSelectorView } from './FormStyleSelectorView';

interface FormStyleSelectorProps {
  value?: CreateFormStyle;
  onChange?: (style: CreateFormStyle) => void;
}

export function FormStyleSelector({ value, onChange }: FormStyleSelectorProps) {
  const { selectedFormStyle, handleStyleChange } = useFormStyleSelectorController({
    value,
    onChange,
  });

  return (
    <FormStyleSelectorView
      selectedFormStyle={selectedFormStyle}
      onStyleChange={handleStyleChange}
    />
  );
}
