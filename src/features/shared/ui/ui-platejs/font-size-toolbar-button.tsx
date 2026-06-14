import { useFontSizeToolbarButtonController } from '@/features/shared/hooks/useFontSizeToolbarButtonController';
import { FontSizeToolbarButtonView } from './FontSizeToolbarButtonView';

export function FontSizeToolbarButton() {
  return <FontSizeToolbarButtonView {...useFontSizeToolbarButtonController()} />;
}
