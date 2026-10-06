import { ProjectContextChips } from '@/features/project-chat/ui/ProjectContextChips';
import { editorContextSchema } from '@/features/project-chat/logic/contracts';
import { useEffect, useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { AiTrace, AiTraceOperation } from '@/lib/ai/trace';
import { localizeAppError } from '@/features/shared/errors/app-error';

function Payload({ value, label }: { value: unknown; label: string }) {
  if (value == null) return null;
  return (
    <details>
      <summary className="cursor-pointer">{label}</summary>
      <pre className="bg-muted max-h-80 overflow-auto rounded p-2 text-xs break-words whitespace-pre-wrap">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

function Operations({
  operations,
  parent = null,
}: {
  operations: AiTraceOperation[];
  parent?: string | null;
}) {
  const { t } = useTranslation();
  return (
    <ol className="space-y-2 border-l pl-3">
      {operations
        .filter(operation => operation.parent_operation_id === parent)
        .map(operation => (
          <li key={operation.id}>
            <details>
              <summary className="cursor-pointer break-words">
                {operation.name} · {t(`common.aiTrace.status.${operation.status}`)}
                {operation.finished_at
                  ? ` · ${operation.finished_at - operation.created_at} ms`
                  : ''}
                {operation.attempt > 1
                  ? ` · ${t('common.aiTrace.attempt')} ${operation.attempt}`
                  : ''}
              </summary>
              <p className="text-muted-foreground text-xs break-all">
                {operation.kind} · {operation.id}
                {operation.tool_call_id ? ` · ${operation.tool_call_id}` : ''}
              </p>
              <Payload value={operation.input} label={t('common.aiTrace.input')} />
              <Payload value={operation.output} label={t('common.aiTrace.output')} />
              {operation.error ? (
                <p className="text-destructive">
                  {localizeAppError(operation.error, { logUnknown: false })}
                </p>
              ) : null}
              <Payload value={operation.error} label={t('common.aiTrace.error')} />
              <Payload value={operation.metadata} label={t('common.aiTrace.metadata')} />
            </details>
            <Operations operations={operations} parent={operation.id} />
          </li>
        ))}
    </ol>
  );
}

export function AiTraceDetails({
  traceId,
  messageId,
  documentId,
}: {
  traceId?: string | null;
  messageId?: string;
  documentId?: string;
}) {
  const { session } = useAuth();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [traces, setTraces] = useState<AiTrace[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!open || !session?.access_token) return;
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    setTraces([]);
    const params = new URLSearchParams(
      traceId ? { traceId } : documentId ? { documentId } : { messageId: messageId ?? '' }
    );
    void fetch(`/api/ai/traces?${params}`, {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(async response => {
        if (!response.ok) throw new Error('diagnostics_unavailable');
        return response.json();
      })
      .then(value => {
        if (!controller.signal.aborted) setTraces(value.traces ?? []);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [open, traceId, messageId, documentId, session?.access_token, revision]);
  return (
    <details
      className="text-muted-foreground max-w-full text-xs"
      open={open}
      onToggle={event => setOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer">{t('common.aiTrace.title')}</summary>
      <div className="text-foreground space-y-3 rounded border p-3">
        <button type="button" className="underline" onClick={() => setRevision(value => value + 1)}>
          {t('common.aiTrace.refresh')}
        </button>
        {loading ? (
          <p role="status">{t('common.aiTrace.loading')}</p>
        ) : failed ? (
          <p role="alert">{t('common.aiTrace.unavailable')}</p>
        ) : traces.length === 0 ? (
          <p>{t('common.aiTrace.empty')}</p>
        ) : (
          traces.map(trace => (
            <section key={trace.id} className="space-y-2">
              <p className="break-all">
                {trace.surface} · {trace.invocation} · {trace.id}
              </p>
              {trace.origin_message_id ? (
                <a className="underline" href={`#message-${trace.origin_message_id}`}>
                  {t('common.aiTrace.origin')}
                </a>
              ) : null}
              <ProjectContextChips
                sourceContext={
                  editorContextSchema.safeParse(
                    (trace.prompt as { editorContext?: unknown })?.editorContext
                  ).data
                }
                references={
                  editorContextSchema.safeParse(
                    (trace.prompt as { editorContext?: unknown })?.editorContext
                  ).data?.references ?? []
                }
              />
              <Payload value={trace.prompt} label={t('common.aiTrace.prompt')} />
              <Operations operations={trace.operations} />
            </section>
          ))
        )}
      </div>
    </details>
  );
}
