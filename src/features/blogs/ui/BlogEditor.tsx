'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import { Textarea } from '@/features/shared/ui/ui/textarea';
import { Label } from '@/features/shared/ui/ui/label';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useBlogState } from '@/zero/blogs/useBlogState';
import { useBlogActions } from '@/zero/blogs/useBlogActions';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface BlogEditorProps {
  blogId: string;
}

export function BlogEditor({ blogId }: BlogEditorProps) {
  const { blog } = useBlogState({ blogId });
  const { updateBlog } = useBlogActions();
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Initialize content when blog loads
  useEffect(() => {
    if (blog?.content) {
      setContent(blog.content as string);
    }
  }, [blog]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateBlog({
        id: blogId,
        content,
      });
      toast.success(
        translateText('generated.inline.0265_blog_content_saved_successfully_53103bde')
      );
    } catch (error) {
      console.error('Error saving blog content:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!blog) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
        <p className="text-muted-foreground">
          {translateText('generated.inline.0266_loading_blog_editor_00ccfa0b')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">
          {translateText('generated.inline.0267_blog_editor_b05a0e7d')}
        </h1>
        <Button onClick={handleSave} disabled={isSaving}>
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
          <CardTitle>{blog.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="content">
              {translateText('generated.inline.0270_blog_content_75727b2c')}
            </Label>
            <Textarea
              id="content"
              value={content}
              onChange={e => setContent(e.target.value)}
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
