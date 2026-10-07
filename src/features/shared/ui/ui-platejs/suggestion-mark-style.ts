import { getSemanticToneClasses } from '@/features/shared/theme';
import { cn } from '@/features/shared/utils/utils';

export function suggestionPreviewClassName(type: 'insert' | 'remove') {
  const tone = getSemanticToneClasses(type === 'remove' ? 'danger' : 'success');
  return cn(
    'box-decoration-clone rounded-sm border px-0.5 no-underline',
    tone.surface,
    type === 'remove' && 'line-through'
  );
}
