import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  currencies: vi.fn(),
  getSession: vi.fn(),
  getAuth: vi.fn(async () => ({ userID: 'user' })),
  process: vi.fn(),
  handleQuery: vi.fn(),
  queryFn: vi.fn(() => ({ query: true })),
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => options,
}));
vi.mock('ai', () => ({
  generateText: vi.fn(),
  stepCountIs: vi.fn(),
  streamText: vi.fn(),
  tool: vi.fn((definition: unknown) => definition),
}));
vi.mock('@/lib/supabase/server', () => ({ getSession: mocks.getSession }));
vi.mock('@/server/ai-db', () => ({
  enrichAiAttachmentsForPrompt: vi.fn(),
  enrichAiAttachmentsFromContextJson: vi.fn(),
  getAiSkillsBySlugs: vi.fn(),
  getAiToolsByNames: vi.fn(),
  getAssistantConversationForUser: vi.fn(),
  getConversationMessagesForAi: vi.fn(),
  isAssistantSender: vi.fn(),
  persistAssistantMessage: vi.fn(),
  setAssistantConversationTitle: vi.fn(),
  touchAiCredential: vi.fn(),
}));
vi.mock('@/server/ai-models', () => ({
  getAiCatalog: vi.fn(),
  resolveLanguageModelForUser: vi.fn(),
}));
vi.mock('@/server/ai-tools', () => ({
  buildAiTools: vi.fn(() => ({})),
  buildCurrentUserScopePrompt: vi.fn(),
}));
vi.mock('@/server/currency/frankfurter', () => ({
  getFrankfurterCurrencies: mocks.currencies,
}));
vi.mock('@/server/zero-auth', () => ({ getAuthFromRequest: mocks.getAuth }));
vi.mock('@/zero/server-notify', () => ({
  withNotificationDeliveryQueue: (callback: () => unknown) => callback(),
}));
vi.mock('@/server/zero-mutate', () => ({ sanitizeZeroMutationResult: (value: unknown) => value }));
vi.mock('@/zero/server-mutators', () => ({ serverMutators: {} }));
vi.mock('@/zero/db-provider', () => ({ dbProvider: {} }));
vi.mock('@/zero/queries', () => ({ queries: {} }));
vi.mock('@/zero/schema', () => ({ schema: {} }));
vi.mock('@rocicorp/zero/server', () => ({
  PushProcessor: class {
    process(...args: unknown[]) {
      return mocks.process(...args);
    }
  },
  handleQueryRequest: (...args: unknown[]) => mocks.handleQuery(...args),
}));
vi.mock('@rocicorp/zero', () => ({
  mustGetQuery: () => ({ fn: mocks.queryFn }),
}));

import { Route as ChatRoute } from '../ai/chat';
import { Route as CopilotRoute } from '../ai/copilot';
import { Route as CurrenciesRoute } from '../currency/currencies';
import { Route as MutateRoute } from '../mutate';
import { Route as QueryRoute } from '../query';

const request = new Request('http://localhost/api/test', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({}),
});

describe('A10 API handler LSF contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue(null);
  });

  it('invokes AI route adapters', async () => {
    const chat = await (ChatRoute as any).server.handlers.POST({ request });
    const copilot = await (CopilotRoute as any).server.handlers.POST({ request });
    expect(chat.status).toBe(401);
    expect(copilot.status).toBe(401);
  });

  it('serves live and fallback currency catalogues', async () => {
    mocks.currencies.mockResolvedValueOnce(['EUR', 'USD']);
    let response = await (CurrenciesRoute as any).server.handlers.GET();
    await expect(response.json()).resolves.toMatchObject({ source: 'frankfurter' });

    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.currencies.mockRejectedValueOnce(new Error('offline'));
    response = await (CurrenciesRoute as any).server.handlers.GET();
    await expect(response.json()).resolves.toMatchObject({ source: 'fallback' });
  });

  it('runs successful and failed Zero mutation handlers', async () => {
    mocks.process.mockResolvedValueOnce({ ok: true });
    let response = await (MutateRoute as any).server.handlers.POST({ request });
    await expect(response.json()).resolves.toEqual({ ok: true });

    mocks.process.mockRejectedValueOnce(new Error('mutation failed'));
    response = await (MutateRoute as any).server.handlers.POST({ request });
    expect(response.status).toBe(500);
  });

  it('builds and executes the dynamic Zero query transformer', async () => {
    mocks.handleQuery.mockImplementation(async (transform: any) => {
      expect(transform('query-name', { value: 1 })).toEqual({ query: true });
      return { rows: [] };
    });
    const response = await (QueryRoute as any).server.handlers.POST({ request });
    await expect(response.json()).resolves.toEqual({ rows: [] });
    expect(mocks.queryFn).toHaveBeenCalledWith({
      args: { value: 1 },
      ctx: { userID: 'user' },
    });
  });
});
