import type { SlateElementProps } from 'platejs/static';

import { useTocElementStaticController } from '@/features/shared/hooks/useTocElementStaticController';
import { TocElementStaticView } from './TocElementStaticView';

export function TocElementStatic(props: SlateElementProps) {
  return <TocElementStaticView {...props} {...useTocElementStaticController(props.editor)} />;
}
