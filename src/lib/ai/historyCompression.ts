export interface AiPromptHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CompressConversationHistoryOptions {
  systemPrompt: string;
  messages: readonly AiPromptHistoryMessage[];
  contextWindow: number | null;
}

export interface CompressConversationHistoryResult {
  messages: AiPromptHistoryMessage[];
  estimatedTokens: number;
  wasCompressed: boolean;
  compressedMessageCount: number;
}

const CHARS_PER_TOKEN = 4;
const COMPRESSION_TRIGGER_RATIO = 0.82;
const MIN_RESERVED_TOKENS = 4096;
const MIN_RECENT_MESSAGES = 4;
const DEFAULT_RECENT_MESSAGES = 12;
const SUMMARY_LINE_LENGTHS = [220, 160, 120, 80] as const;

export function estimateAiTextTokens(text: string): number {
  const normalized = text.replace(/\s+/g, ' ').trim();

  if (!normalized) {
    return 0;
  }

  return Math.ceil(normalized.length / CHARS_PER_TOKEN);
}

function estimateMessageTokens(message: AiPromptHistoryMessage): number {
  return estimateAiTextTokens(message.content) + 8;
}

function estimateConversationTokens(
  systemPrompt: string,
  messages: readonly AiPromptHistoryMessage[]
): number {
  return (
    estimateAiTextTokens(systemPrompt) +
    messages.reduce((total, message) => total + estimateMessageTokens(message), 0)
  );
}

function compactMessageContent(content: string, maxChars: number): string {
  const normalized = content.replace(/\s+/g, ' ').trim();

  if (!normalized) {
    return '[empty]';
  }

  if (normalized.length <= maxChars) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

function buildCompressedHistoryMessage(
  messages: readonly AiPromptHistoryMessage[],
  maxCharsPerMessage: number
): AiPromptHistoryMessage {
  const lines = messages.map((message, index) => {
    const speaker = message.role === 'assistant' ? 'Assistant' : 'User';
    const content = compactMessageContent(message.content, maxCharsPerMessage);
    return `${index + 1}. ${speaker}: ${content}`;
  });

  return {
    role: 'user',
    content: [
      'Earlier conversation history was compressed by Polity to stay inside the model context window.',
      'Treat this as authoritative prior chat context and preserve facts, decisions, unresolved questions, and commitments from it.',
      '',
      ...lines,
    ].join('\n'),
  };
}

export function compressConversationHistory(
  options: CompressConversationHistoryOptions
): CompressConversationHistoryResult {
  const { systemPrompt, messages, contextWindow } = options;
  const initialMessages = [...messages];
  const initialEstimatedTokens = estimateConversationTokens(systemPrompt, initialMessages);

  if (!contextWindow || initialMessages.length <= MIN_RECENT_MESSAGES) {
    return {
      messages: initialMessages,
      estimatedTokens: initialEstimatedTokens,
      wasCompressed: false,
      compressedMessageCount: 0,
    };
  }

  const compressionTriggerTokens = Math.floor(contextWindow * COMPRESSION_TRIGGER_RATIO);
  if (initialEstimatedTokens <= compressionTriggerTokens) {
    return {
      messages: initialMessages,
      estimatedTokens: initialEstimatedTokens,
      wasCompressed: false,
      compressedMessageCount: 0,
    };
  }

  const targetTokens = Math.max(
    1024,
    contextWindow - Math.max(MIN_RESERVED_TOKENS, Math.floor(contextWindow * 0.18))
  );
  const maxRecentMessages = Math.min(DEFAULT_RECENT_MESSAGES, initialMessages.length - 1);

  let bestResult: CompressConversationHistoryResult = {
    messages: initialMessages,
    estimatedTokens: initialEstimatedTokens,
    wasCompressed: false,
    compressedMessageCount: 0,
  };

  for (const maxCharsPerMessage of SUMMARY_LINE_LENGTHS) {
    for (
      let recentMessageCount = maxRecentMessages;
      recentMessageCount >= MIN_RECENT_MESSAGES;
      recentMessageCount -= 2
    ) {
      const compressedMessages = initialMessages.slice(0, -recentMessageCount);
      const recentMessages = initialMessages.slice(-recentMessageCount);

      if (compressedMessages.length === 0) {
        continue;
      }

      const summaryMessage = buildCompressedHistoryMessage(compressedMessages, maxCharsPerMessage);
      const candidateMessages = [summaryMessage, ...recentMessages];
      const estimatedTokens = estimateConversationTokens(systemPrompt, candidateMessages);

      const candidate: CompressConversationHistoryResult = {
        messages: candidateMessages,
        estimatedTokens,
        wasCompressed: true,
        compressedMessageCount: compressedMessages.length,
      };

      if (!bestResult.wasCompressed || candidate.estimatedTokens < bestResult.estimatedTokens) {
        bestResult = candidate;
      }

      if (estimatedTokens <= targetTokens) {
        return candidate;
      }
    }
  }

  return bestResult;
}
