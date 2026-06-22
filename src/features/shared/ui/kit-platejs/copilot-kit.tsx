import type { TElement } from 'platejs';

import { CopilotPlugin } from '@platejs/ai/react';
import { serializeMd, stripMarkdown } from '@platejs/markdown';
import * as React from 'react';

import { GhostText } from '@/features/shared/ui/ui-platejs/ghost-text.tsx';
import { useAuth } from '@/providers/auth-provider';

import { MarkdownKit } from './markdown-kit.tsx';

export const COPILOT_DEBOUNCE_DELAY_MS = 1500;
export const COPILOT_MIN_PROMPT_CHARACTERS = 24;

export function shouldRequestCopilotSuggestion(prompt: string): boolean {
  const text = stripMarkdown(prompt).replace(/\s+/g, ' ').trim();

  return text.length >= COPILOT_MIN_PROMPT_CHARACTERS;
}

export const CopilotKit = [
  ...MarkdownKit,
  CopilotPlugin.configure(({ api, getOption, setOption }) => ({
    options: {
      completeOptions: {
        api: '/api/ai/copilot',
        body: {
          system: `You are an advanced AI writing assistant, similar to VSCode Copilot but for general text. Your task is to predict and generate the next part of the text based on the given context.
  
  Rules:
  - Continue the text naturally up to the next punctuation mark (., ,, ;, :, ?, or !).
  - Maintain style and tone. Don't repeat given text.
  - For unclear context, provide the most likely continuation.
  - Handle code snippets, lists, or structured text if needed.
  - Don't include """ in your response.
  - CRITICAL: Always end with a punctuation mark.
  - CRITICAL: Avoid starting a new block. Do not use block formatting like >, #, 1., 2., -, etc. The suggestion should continue in the same block as the context.
  - If no context is provided or you can't generate a continuation, return "0" without explanation.`,
        },
        onFinish: (_, completion) => {
          const text = stripMarkdown(completion).trim();

          if (!text || text === '0') return;

          api.copilot.setBlockSuggestion({
            text,
          });
        },
      },
      debounceDelay: COPILOT_DEBOUNCE_DELAY_MS,
      renderGhostText: GhostText,
      getPrompt: ({ editor }) => {
        const contextEntry = editor.api.block({ highest: true });

        if (!contextEntry) return '';

        const prompt = serializeMd(editor, {
          value: [contextEntry[0] as TElement],
        });

        if (!shouldRequestCopilotSuggestion(prompt)) return '';

        return `Continue the text up to the next punctuation mark:
  """
  ${prompt}
  """`;
      },
    },
    useHooks: () => {
      const { session } = useAuth();

      React.useEffect(() => {
        const completeOptions = getOption('completeOptions') ?? {};
        const headers = new Headers(completeOptions.headers);

        if (session?.access_token) {
          headers.set('Authorization', `Bearer ${session.access_token}`);
        } else {
          headers.delete('Authorization');
        }

        const headerObject: Record<string, string> = {};
        headers.forEach((value, key) => {
          headerObject[key] = value;
        });

        setOption('completeOptions', {
          ...completeOptions,
          headers: headerObject,
        });
      }, [getOption, session?.access_token, setOption]);
    },
    shortcuts: {
      accept: {
        keys: 'tab',
      },
      acceptNextWord: {
        keys: 'mod+right',
      },
      reject: {
        keys: 'escape',
      },
      triggerSuggestion: {
        keys: 'ctrl+space',
      },
    },
  })),
];
