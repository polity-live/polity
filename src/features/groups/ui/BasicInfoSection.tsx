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
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
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
        <CardTitle>{translateText('generated.inline.0658_basic_information_b0d5be39')}</CardTitle>
        <CardDescription>
          {translateText('generated.inline.0659_public_group_information_7e7a6fbc')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ValidatedInputField
          id="name"
          label={translateText('generated.inline.0660_group_name_4e4d5191')}
          value={formData.name}
          onChange={onNameChange}
          placeholder={translateText('generated.inline.0661_group_name_ebb7e14b')}
          validator={value => hasMinLength(value, 3)}
          hint={t('common.validation.nameHint')}
          required
        />
        <div className="space-y-2">
          <Label htmlFor="description">
            {translateText('generated.inline.0030_description_55f8ebc8')}
          </Label>
          <MiniPlateEditor
            id="description"
            value={formData.descriptionContent}
            onChange={onDescriptionContentChange}
            placeholder={translateText(
              'generated.inline.0662_describe_the_group_and_its_purpose_04fd28f2'
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}
