import type { ThemePalette } from '@/features/shared/appearance-theme/contract';
import type { StudioTextSelectionEditor } from '../ui/StudioTextEditor';
import type { StudioElement } from './document';
import { paletteColor, themeFontFamily, type StudioThemeSnapshot } from './theme';

export function applyStudioSelectionTextStyle({
  styleId,
  theme,
  palette,
  editor,
  active,
  applyToSelection,
}: {
  styleId: string;
  theme: StudioThemeSnapshot | null | undefined;
  palette: ThemePalette | null;
  editor: StudioTextSelectionEditor | null;
  active: StudioElement | undefined;
  applyToSelection: (styleId: string) => void;
}) {
  const style = theme?.textStyles.find(item => item.id === styleId);
  if (!style || !palette) return;
  if (editor && active?.type === 'text') {
    editor.setMark('textStyleId', style.id);
    editor.setMark('fontFamily', themeFontFamily(style.font));
    editor.setMark('fontSize', style.size);
    editor.setMark('colorBinding', style.color);
    editor.setMark('color', paletteColor(palette, style.color));
    editor.setMark('bold', style.bold);
    editor.setMark('italic', style.italic);
    editor.setMark('underline', style.underline);
    editor.paragraph('align', style.align);
    return;
  }
  applyToSelection(styleId);
}
