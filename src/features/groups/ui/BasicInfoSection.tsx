/**
 * Basic Info Section Component
 *
 * Form section for editing basic group information (name and description).
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { hasMinLength } from '@/features/shared/logic/inputValidation';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { ValidatedInputField } from '@/features/shared/ui/form/ValidatedInputField';
import { Label } from '@/features/shared/ui/ui/label';
import { Textarea } from '@/features/shared/ui/ui/textarea';
import type { GroupFormData } from '../hooks/useGroupUpdate';

interface BasicInfoSectionProps {
  formData: GroupFormData;
  onChange: (field: keyof GroupFormData, value: string) => void;
}

export function BasicInfoSection({ formData, onChange }: BasicInfoSectionProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Basic Information</CardTitle>
        <CardDescription>Public group information</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ValidatedInputField
          id="name"
          label="Group Name *"
          value={formData.name}
          onChange={value => onChange('name', value)}
          placeholder="Group name"
          validator={value => hasMinLength(value, 3)}
          hint={t('common.validation.nameHint')}
          required
        />
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={e => onChange('description', e.target.value)}
            placeholder="Describe the group and its purpose..."
            rows={6}
          />
        </div>
      </CardContent>
    </Card>
  );
}
