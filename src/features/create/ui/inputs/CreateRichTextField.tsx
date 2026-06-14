import type { Value } from 'platejs';
import { FormControlLabel } from '@/features/shared/ui/form';
import { MiniPlateEditor } from '@/features/shared/ui/form/MiniPlateEditor';

interface CreateRichTextFieldProps {
  label: string;
  description: string;
  value: Value;
  onChange: (value: Value) => void;
  placeholder?: string;
}

export function CreateRichTextField({
  label,
  description,
  value,
  onChange,
  placeholder,
}: CreateRichTextFieldProps) {
  return (
    <div className="space-y-2">
      <FormControlLabel>{label}</FormControlLabel>
      <p className="text-muted-foreground text-xs">{description}</p>
      <MiniPlateEditor value={value} onChange={onChange} placeholder={placeholder} />
    </div>
  );
}
