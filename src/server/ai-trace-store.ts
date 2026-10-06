import type { JSONValue } from 'postgres';
import { studioSql } from './studio/db';
import type { AiTrace, AiTraceOperation } from '@/lib/ai/trace';

const json = (value: unknown) => studioSql().json((value ?? null) as JSONValue);

export async function insertAiTrace(value: {
  id: string;
  actorId: string;
  conversationId?: string;
  originMessageId?: string;
  studioProjectId?: string;
  amendmentId?: string;
  documentId?: string;
  surface: string;
  invocation: string;
  prompt: unknown;
}) {
  await studioSql().unsafe(
    `insert into ai_diagnostics.ai_trace
    (id,actor_id,conversation_id,origin_message_id,studio_project_id,amendment_id,document_id,surface,invocation,prompt,created_at)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11) on conflict(id) do nothing`,
    [
      value.id,
      value.actorId,
      value.conversationId ?? null,
      value.originMessageId ?? null,
      value.studioProjectId ?? null,
      value.amendmentId ?? null,
      value.documentId ?? null,
      value.surface,
      value.invocation,
      json(value.prompt),
      Date.now(),
    ]
  );
}

export async function insertAiOperation(operation: AiTraceOperation) {
  await studioSql().unsafe(
    `insert into ai_diagnostics.ai_trace_operation
    (id,trace_id,parent_operation_id,kind,name,status,tool_call_id,attempt,input,metadata,created_at)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11)`,
    [
      operation.id,
      operation.trace_id,
      operation.parent_operation_id,
      operation.kind,
      operation.name,
      operation.status,
      operation.tool_call_id,
      operation.attempt,
      json(operation.input),
      json(operation.metadata),
      operation.created_at,
    ]
  );
}

export async function finishAiOperation(
  id: string,
  status: string,
  output: unknown,
  error: unknown,
  metadata: unknown
) {
  await studioSql().unsafe(
    `update ai_diagnostics.ai_trace_operation set status=$2,output=$3::jsonb,error=$4::jsonb,
    metadata=metadata || $5::jsonb,finished_at=$6 where id=$1 and status='running'`,
    [id, status, json(output), json(error), json(metadata), Date.now()]
  );
}

export async function linkAiResponse(traceId: string, messageId: string) {
  await studioSql().unsafe(
    'update ai_diagnostics.ai_trace set response_message_id=$2 where id=$1',
    [traceId, messageId]
  );
}

export async function linkAiStudioProject(traceId: string, projectId: string) {
  await studioSql().unsafe('update ai_diagnostics.ai_trace set studio_project_id=$2 where id=$1', [
    traceId,
    projectId,
  ]);
}

export async function parentAiModelForTool(traceId: string, toolCallId: string) {
  const [operation] = await studioSql().unsafe<{ id: string }[]>(
    `select id from ai_diagnostics.ai_trace_operation
    where trace_id=$1 and kind='model' and output->'toolCalls' @> $2::jsonb
    order by created_at desc limit 1`,
    [traceId, json([{ toolCallId }])]
  );
  return operation?.id;
}

export async function findAiTraces(
  actorId: string,
  selector: { traceId?: string; messageId?: string; documentId?: string }
) {
  // Only the requesting actor may inspect raw model inputs and personal tool results.
  // Current conversation/resource access is checked separately by the API.
  const sql = studioSql();
  const traces = await sql.unsafe<AiTrace[]>(
    `select * from ai_diagnostics.ai_trace where actor_id=$1 and
    (($2::uuid is not null and id=$2) or
     ($3::uuid is not null and (origin_message_id=$3 or response_message_id=$3)) or
     ($4::uuid is not null and document_id=$4)) order by created_at desc limit 20`,
    [actorId, selector.traceId ?? null, selector.messageId ?? null, selector.documentId ?? null]
  );
  for (const trace of traces) {
    trace.created_at = Number(trace.created_at);
    trace.operations = await sql.unsafe<AiTraceOperation[]>(
      'select * from ai_diagnostics.ai_trace_operation where trace_id=$1 order by created_at,id',
      [trace.id]
    );
    for (const operation of trace.operations) {
      operation.created_at = Number(operation.created_at);
      if (operation.finished_at !== null) operation.finished_at = Number(operation.finished_at);
    }
  }
  return traces;
}
