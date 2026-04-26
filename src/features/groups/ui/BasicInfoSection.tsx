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
import { MiniPlateEditor } from '@/features/shared/ui/form/MiniPlateEditor';
import { ValidatedInputField } from '@/features/shared/ui/form/ValidatedInputField';
import { Label } from '@/features/shared/ui/ui/label';
import type { Value } from 'platejs';
import type { GroupFormData } from '../hooks/useGroupUpdate';

interface BasicInfoSectionProps {
  formData: GroupFormData;
  onNameChange: (value: string) => void;
  onDescriptionContentChange: (value: Value) => void;
}

export function BasicInfoSection({
  formData,
  onNameChange,
  onDescriptionContentChange,
}: BasicInfoSectionProps) {
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
          onChange={onNameChange}
          placeholder="Group name"
          validator={value => hasMinLength(value, 3)}
          hint={t('common.validation.nameHint')}
          required
        />
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <MiniPlateEditor
            id="description"
            value={formData.descriptionContent}
            onChange={onDescriptionContentChange}
            placeholder="Describe the group and its purpose..."
          />
        </div>
      </CardContent>
    </Card>
  );
}
