import type { ModelMessage } from 'ai';
import { ProjectToolError } from '@/features/project-chat/logic/contracts';

/** Keep provider tool-call/result pairs intact. Compact older context results,
 * never the latest result or the current user instruction. Full audit stays in DB. */
export function boundedProjectHistory(
  input: ModelMessage[],
  maxCharacters: number
): ModelMessage[] {
  const result = structuredClone(input);
  const size = () => JSON.stringify(result).length;
  let currentTurn = 0;
  for (let i = 0; i < result.length; i++) if (result[i].role === 'user') currentTurn = i;
  // Drop complete prior turns together: removing individual messages can leave an
  // orphaned tool result or an assistant reply without its initiating user turn.
  if (size() > maxCharacters && currentTurn > 0) result.splice(0, currentTurn);
  for (let i = 0; size() > maxCharacters && i < result.length - 1; i++) {
    const message = result[i];
    if (message.role !== 'tool') continue;
    result[i] = {
      ...message,
      content: message.content.map(part =>
        JSON.stringify(part).length < 4000
          ? part
          : {
              ...part,
              output: {
                type: 'json',
                value: {
                  omitted: true,
                  instruction:
                    'Earlier context omitted to fit the model. Read the resource again before editing it.',
                },
              },
            }
      ),
    };
  }
  if (size() > maxCharacters)
    throw new ProjectToolError(
      'context_too_large',
      'Read a smaller resource page or start a new project chat.',
      'read_again'
    );
  return result;
}
