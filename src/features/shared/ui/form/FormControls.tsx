import type { ComponentProps } from 'react';

import { Checkbox } from '@/features/shared/ui/ui/checkbox';
import { Button } from '@/features/shared/ui/ui/button';
import { Input } from '@/features/shared/ui/ui/input';
import { Label } from '@/features/shared/ui/ui/label';
import { RadioGroup, RadioGroupItem } from '@/features/shared/ui/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/features/shared/ui/ui/select';
import { Switch } from '@/features/shared/ui/ui/switch';
import { Textarea } from '@/features/shared/ui/ui/textarea';

export function FormControlInput(props: ComponentProps<typeof Input>) {
  return <Input data-slot="form-control-input" {...props} />;
}

export function FormButton(props: ComponentProps<typeof Button>) {
  return <Button data-slot="form-button" {...props} />;
}

export function FormControlTextarea(props: ComponentProps<typeof Textarea>) {
  return <Textarea data-slot="form-control-textarea" {...props} />;
}

export function FormControlLabel(props: ComponentProps<typeof Label>) {
  return <Label data-slot="form-control-label" {...props} />;
}

type FormControlSelectProps = ComponentProps<typeof Select> & {
  'data-action-id'?: string;
};

export function FormControlSelect({
  'data-action-id': _actionId,
  ...props
}: FormControlSelectProps) {
  return <Select data-slot="form-control-select" {...props} />;
}

export function FormControlSelectContent(props: ComponentProps<typeof SelectContent>) {
  return <SelectContent data-slot="form-control-select-content" {...props} />;
}

export function FormControlSelectItem(props: ComponentProps<typeof SelectItem>) {
  return <SelectItem data-slot="form-control-select-item" {...props} />;
}

export function FormControlSelectTrigger(props: ComponentProps<typeof SelectTrigger>) {
  return <SelectTrigger data-slot="form-control-select-trigger" {...props} />;
}

export function FormControlSelectValue(props: ComponentProps<typeof SelectValue>) {
  return <SelectValue data-slot="form-control-select-value" {...props} />;
}

export function FormControlCheckbox(props: ComponentProps<typeof Checkbox>) {
  return <Checkbox data-slot="form-control-checkbox" {...props} />;
}

export function FormControlRadioGroup(props: ComponentProps<typeof RadioGroup>) {
  return <RadioGroup data-slot="form-control-radio-group" {...props} />;
}

export function FormControlRadioGroupItem(props: ComponentProps<typeof RadioGroupItem>) {
  return <RadioGroupItem data-slot="form-control-radio-group-item" {...props} />;
}

export function FormControlSwitch(props: ComponentProps<typeof Switch>) {
  return <Switch data-slot="form-control-switch" {...props} />;
}
