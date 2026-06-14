import { useTranslation } from '@/features/shared/hooks/use-translation';
import { Panel, PanelContent, PanelHeader, PanelTitle } from '@/features/shared/ui/layout/Panel';
import { Separator } from '@/features/shared/ui/ui/separator';
import { cn } from '@/features/shared/utils/utils';

import { DocsSignalBadge } from './DocsSignalBadge';
import type { DocsProcessDefinition } from '../types/docs.types';

interface ProcessDiagramProps {
  baseKey: string;
  process: DocsProcessDefinition;
}

export function ProcessDiagram({ baseKey, process }: ProcessDiagramProps) {
  const { t } = useTranslation();

  return (
    <Panel>
      <PanelHeader className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <PanelTitle className="text-xl">{t(`${baseKey}.diagram.title`)}</PanelTitle>
          <DocsSignalBadge tone={process.steps[process.steps.length - 1]?.tone ?? 'result'} />
        </div>
        <p className="text-muted-foreground max-w-3xl text-sm leading-6">
          {t(`${baseKey}.diagram.description`)}
        </p>
      </PanelHeader>
      <PanelContent className="space-y-6">
        {process.kind === 'lanes' && process.lanes ? (
          <div className="grid gap-4 lg:grid-cols-3">
            {process.lanes.map(lane => {
              const laneSteps = process.steps.filter(step => step.lane === lane);

              return (
                <div key={lane} className="bg-background rounded-lg border p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="text-muted-foreground text-sm font-semibold tracking-[0.2em] uppercase">
                      {t(`${baseKey}.diagram.lanes.${lane}`)}
                    </h3>
                    <span className="text-muted-foreground text-xs">{laneSteps.length}</span>
                  </div>
                  <div className="space-y-3">
                    {laneSteps.map((step, index) => (
                      <div key={step.id} className="bg-card rounded-lg border p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <span className="text-muted-foreground text-xs font-semibold tracking-[0.2em] uppercase">
                            {index + 1}
                          </span>
                          <DocsSignalBadge tone={step.tone} />
                        </div>
                        <h4 className="text-foreground text-sm font-semibold">
                          {t(`${baseKey}.diagram.steps.${step.id}.title`)}
                        </h4>
                        <p className="text-muted-foreground mt-2 text-sm leading-6">
                          {t(`${baseKey}.diagram.steps.${step.id}.description`)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {process.steps.map((step, index) => (
              <div key={step.id} className="bg-background relative rounded-lg border p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <span className="text-muted-foreground text-xs font-semibold tracking-[0.2em] uppercase">
                    {t('pages.docs.labels.step', { value: index + 1 })}
                  </span>
                  <DocsSignalBadge tone={step.tone} />
                </div>
                <h4 className="text-foreground text-base font-semibold">
                  {t(`${baseKey}.diagram.steps.${step.id}.title`)}
                </h4>
                <p className="text-muted-foreground mt-2 text-sm leading-6">
                  {t(`${baseKey}.diagram.steps.${step.id}.description`)}
                </p>
                {index < process.steps.length - 1 ? (
                  <div className="bg-border pointer-events-none absolute top-1/2 -right-3 hidden h-px w-6 lg:block" />
                ) : null}
              </div>
            ))}
          </div>
        )}
        <Separator />
        <div
          className={cn(
            'grid gap-4',
            process.kind === 'lanes' ? 'md:grid-cols-2' : 'md:grid-cols-3'
          )}
        >
          {process.steps.map(step => (
            <div
              key={`legend-${step.id}`}
              className="bg-background rounded-lg border border-dashed p-4"
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-foreground text-sm font-medium">
                  {t(`${baseKey}.diagram.steps.${step.id}.title`)}
                </span>
                <DocsSignalBadge tone={step.tone} />
              </div>
              <p className="text-muted-foreground text-sm leading-6">
                {t(`${baseKey}.diagram.steps.${step.id}.description`)}
              </p>
            </div>
          ))}
        </div>
      </PanelContent>
    </Panel>
  );
}
