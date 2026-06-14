import { FormControlLabel } from '@/features/shared/ui/form';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { Value } from 'platejs';
import { MiniPlateEditor } from '@/features/shared/ui/form/MiniPlateEditor';

interface AboutSectionProps {
  aboutContent: Value;
  onAboutContentChange: (value: Value) => void;
}

export function AboutSection({ aboutContent, onAboutContentChange }: AboutSectionProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('pages.user.settingsForm.about.title')}</CardTitle>
        <CardDescription>{t('pages.user.settingsForm.about.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <FormControlLabel htmlFor="about">
            {t('pages.user.settingsForm.about.bioLabel')}
          </FormControlLabel>
          <MiniPlateEditor
            id="about"
            value={aboutContent}
            onChange={onAboutContentChange}
            placeholder={t('pages.user.settingsForm.about.bioPlaceholder')}
          />
        </div>
      </CardContent>
    </Card>
  );
}
