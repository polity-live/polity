import { Loader2, Save } from 'lucide-react';

import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { PageSkeleton } from '@/features/shared/ui/feedback';
import { FormControlLabel, FormControlTextarea } from '@/features/shared/ui/form';
import { Button } from '@/features/shared/ui/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/features/shared/ui/ui/card';

interface BlogEditorViewProps {
  blogTitle?: string | null;
  content: string;
  isLoaded: boolean;
  isSaving: boolean;
  onContentChange: (content: string) => void;
  onSave: () => void | Promise<void>;
}

export function BlogEditorView({
  blogTitle,
  content,
  isLoaded,
  isSaving,
  onContentChange,
  onSave,
}: BlogEditorViewProps) {
  if (!isLoaded) {
    return (
      <PageSkeleton
        variant="settings"
        label={translateText('generated.inline.0266_loading_blog_editor_00ccfa0b')}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">
          {translateText('generated.inline.0267_blog_editor_b05a0e7d')}
        </h1>
        <Button onClick={onSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {translateText('generated.inline.0268_saving_ae7e8875')}
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              {translateText('generated.inline.0269_save_efc007a3')}
            </>
          )}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{blogTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <FormControlLabel htmlFor="content">
              {translateText('generated.inline.0270_blog_content_75727b2c')}
            </FormControlLabel>
            <FormControlTextarea
              id="content"
              value={content}
              onChange={event => onContentChange(event.target.value)}
              placeholder={translateText(
                'generated.inline.0271_write_your_blog_content_here_580320ae'
              )}
              rows={20}
              className="font-mono"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
