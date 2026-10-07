import { streamText as sdkStreamText, generateText as sdkGenerateText, type ToolSet } from 'ai';
import {
  currentAiTrace,
  withAiTrace,
  startAiOperation,
  endAiOperation,
  traceAiOperation,
  type AiTraceContext,
} from './ai-trace';

type Options = Parameters<typeof sdkStreamText>[0];
type EventCallback = (event: any) => unknown;

function generationOptions(options: Options, root: AiTraceContext) {
  let step: AiTraceContext | undefined;
  const executedTools = new Set<string>();
  const context = { ...root, modelContext: () => step };
  const tools: ToolSet | undefined =
    options.tools &&
    Object.fromEntries(
      Object.entries(options.tools).map(([name, definition]) => {
        const execute = definition.execute;
        return [
          name,
          {
            ...definition,
            ...(execute
              ? {
                  execute: (input: unknown, execution: any) => {
                    // The SDK calls onStepStart before execute and supplies a toolCallId.
                    executedTools.add(execution.toolCallId);
                    return withAiTrace(step as AiTraceContext, () =>
                      traceAiOperation(
                        'tool',
                        name,
                        input,
                        async () => execute(input as never, execution),
                        { toolCallId: execution.toolCallId }
                      )
                    );
                  },
                }
              : {}),
          },
        ];
      })
    );
  const original = options as Options & Record<string, EventCallback | undefined>;
  return {
    context,
    options: {
      ...options,
      tools,
      onStepStart: async (event: any) => {
        step = await startAiOperation(
          'model',
          event.modelId,
          {
            system: event.system ?? options.system,
            messages: event.messages,
            prompt: options.prompt,
            activeTools: event.activeTools ?? options.activeTools,
            providerOptions: event.providerOptions ?? options.providerOptions,
          },
          {
            metadata: {
              provider: event.provider,
              modelId: event.modelId,
              stepNumber: event.stepNumber,
            },
          },
          context
        );
        root.latestModelOperation = step;
        await (original.onStepStart ?? original.experimental_onStepStart)?.(event);
      },
      onStepEnd: async (event: any) => {
        // Invalid tool arguments never reach execute(), but are still failed calls.
        for (const part of event.content) {
          if (part.type !== 'tool-error' || executedTools.has(part.toolCallId)) continue;
          const call = event.toolCalls?.find(
            (call: { toolCallId: string }) => call.toolCallId === part.toolCallId
          );
          const operation = await startAiOperation(
            'tool',
            part.toolName,
            call?.input,
            { toolCallId: part.toolCallId, metadata: { phase: 'input_validation' } },
            step
          );
          await endAiOperation(operation, 'failed', undefined, part.error);
        }
        await endAiOperation(
          step,
          event.finishReason === 'error' ? 'failed' : 'completed',
          {
            text: event.text,
            toolCalls: event.toolCalls,
            toolResults: event.toolResults,
            response: event.response?.messages,
          },
          undefined,
          { usage: event.usage, finishReason: event.finishReason }
        );
        await (original.onStepEnd ?? original.onStepFinish)?.(event);
      },
      onEnd: async (event: any) => {
        const callback = original.onEnd ?? original.onFinish;
        if (callback)
          await withAiTrace(root, () =>
            traceAiOperation(
              'persistence',
              'finish_response',
              { text: event.text, finishReason: event.finishReason },
              async () => {
                await callback(event);
              }
            )
          );
      },
      onError: async (event: any) => {
        await endAiOperation(step, 'failed', undefined, event.error);
        // Override the SDK's default console.error(error), which dumps credentials and prompts.
        await original.onError?.(event);
      },
      onAbort: async (event: any) => {
        await endAiOperation(step, 'cancelled');
        await original.onAbort?.(event);
      },
    } as Options,
  };
}

export const streamText: typeof sdkStreamText = ((options: Options) => {
  const root = currentAiTrace();
  if (!root) return sdkStreamText(options);
  const wrapped = generationOptions(options, root);
  return withAiTrace(wrapped.context, () => sdkStreamText(wrapped.options));
}) as typeof sdkStreamText;

export const generateText: typeof sdkGenerateText = (async (
  options: Parameters<typeof sdkGenerateText>[0]
) => {
  const root = currentAiTrace();
  if (!root) return sdkGenerateText(options);
  const wrapped = generationOptions(options as Options, root);
  try {
    return await withAiTrace(wrapped.context, () =>
      sdkGenerateText(wrapped.options as Parameters<typeof sdkGenerateText>[0])
    );
  } catch (error) {
    // generateText throws rather than emitting an error part.
    await wrapped.options.onError?.({ error });
    throw error;
  }
}) as typeof sdkGenerateText;
