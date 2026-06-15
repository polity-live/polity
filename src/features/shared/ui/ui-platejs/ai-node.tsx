import { AIChatPlugin } from '@platejs/ai/react';
import {
  type PlateElementProps,
  type PlateTextProps,
  PlateElement,
  PlateText,
  usePluginOption,
} from 'platejs/react';

import { cn } from '@/features/shared/utils/utils.ts';
import { getMotionPreset, getSemanticToneClasses } from '@/features/shared/theme';

export function AILeaf(props: PlateTextProps) {
  const streaming = usePluginOption(AIChatPlugin, 'streaming');
  const streamingLeaf = props.editor.getApi(AIChatPlugin).aiChat.node({ streaming: true });

  const isLast = streamingLeaf?.[0] === props.text;
  const aiTone = getSemanticToneClasses('accent');

  return (
    <PlateText
      className={cn(
        'border-b-2',
        aiTone.surface,
        getMotionPreset('colors'),
        isLast &&
          streaming &&
          'after:bg-primary after:ml-1.5 after:inline-block after:h-3 after:w-3 after:rounded-full after:align-middle after:content-[""]'
      )}
      {...props}
    />
  );
}

export function AIAnchorElement(props: PlateElementProps) {
  return (
    <PlateElement {...props}>
      <div className="h-[0.1px]" />
    </PlateElement>
  );
}
