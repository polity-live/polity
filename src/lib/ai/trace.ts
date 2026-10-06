export interface AiTraceOperation {
  id: string;
  trace_id: string;
  parent_operation_id: string | null;
  kind: string;
  name: string;
  status: string;
  tool_call_id: string | null;
  attempt: number;
  input: unknown;
  output: unknown;
  error: unknown;
  metadata: Record<string, unknown>;
  created_at: number;
  finished_at: number | null;
}

export interface AiTrace {
  id: string;
  conversation_id: string | null;
  origin_message_id: string | null;
  response_message_id: string | null;
  surface: string;
  invocation: string;
  prompt: unknown;
  created_at: number;
  operations: AiTraceOperation[];
}
