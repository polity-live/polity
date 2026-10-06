import { AtSign, X } from 'lucide-react';
import { TooltipHint } from '@/features/shared/ui/ui/tooltip';
import {
  useProjectContextNavigation,
  type ActivateProjectContext,
} from './ProjectContextNavigation';
import type { EditorContext } from '../logic/contracts';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import {
  contextReferenceKey,
  fixedContextReference,
  type ProjectContextReference,
} from '../logic/context-references';

export function ProjectContextChips({
  references,
  onRemove,
  onActivate,
  sourceContext,
}: {
  references: readonly ProjectContextReference[];
  onRemove?: (ref: ProjectContextReference) => void;
  onActivate?: ActivateProjectContext;
  sourceContext?: EditorContext;
}) {
  const { t } = useTranslation();
  const inheritedActivate = useProjectContextNavigation();
  const activate = onActivate ?? inheritedActivate;
  if (!references.length) return null;
  return (
    <div className="flex flex-wrap gap-2" aria-label={t('features.projectChat.context.label')}>
      {references.map(ref => (
        <span
          key={contextReferenceKey(ref)}
          className="inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-1 text-xs"
          title={
            activate && (ref.kind === 'element' || ref.kind === 'frame')
              ? undefined
              : `${t(`features.projectChat.context.${ref.origin}`)} · ${ref.id}`
          }
        >
          {activate && (ref.kind === 'element' || ref.kind === 'frame') ? (
            <TooltipHint content={t('features.projectChat.context.focus')}>
              <button
                type="button"
                className="hover:bg-muted focus-visible:ring-ring inline-flex min-w-0 items-center gap-1 rounded focus-visible:ring-2"
                onClick={() => activate(ref, sourceContext)}
                data-action-id="project-chat.context.focus"
              >
                <AtSign className="size-3 shrink-0" aria-hidden="true" />
                <span className="truncate">
                  {t(`features.projectChat.context.${ref.kind}`)} · {ref.label}
                </span>
              </button>
            </TooltipHint>
          ) : (
            <>
              <AtSign className="size-3 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {t(`features.projectChat.context.${ref.kind}`)} ·{' '}
                {ref.label === 'canonical'
                  ? t('features.projectChat.context.canonical')
                  : ref.label === 'selection'
                    ? t('features.projectChat.context.selection')
                    : ref.label}
              </span>
            </>
          )}
          {onRemove && !fixedContextReference(ref) ? (
            <button
              data-action-id="project-chat.context.reference.remove"
              type="button"
              className="hover:bg-muted rounded p-1"
              onClick={() => onRemove(ref)}
              aria-label={`${t('features.projectChat.context.remove')} ${ref.label}`}
            >
              <X className="size-3" aria-hidden="true" />
            </button>
          ) : null}
        </span>
      ))}
    </div>
  );
}
