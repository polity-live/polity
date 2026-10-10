import { describe, expect, it } from 'vitest';
import { contentMutationCases } from '../mutation-cases-content';
import { statementSharedMutators } from '../../../../src/zero/statements/shared-mutators';
import { todoSharedMutators } from '../../../../src/zero/todos/shared-mutators';
import { documentSharedMutators } from '../../../../src/zero/documents/shared-mutators';
import { blogSharedMutators } from '../../../../src/zero/blogs/shared-mutators';
import { messageSharedMutators } from '../../../../src/zero/messages/shared-mutators';
import { studioSharedMutators } from '../../../../src/zero/communication-studio/shared-mutators';
import { projectChatSharedMutators } from '../../../../src/zero/project-chat/shared-mutators';

describe('reviewed content mutation specifications', () => {
  it('keeps case identities unique and oracle specifications serializable', () => {
    const cases = contentMutationCases();
    const keys = cases.map(c => `${c.name}/${c.variant}/${c.actor}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const c of cases) {
      expect(JSON.parse(JSON.stringify(c.specification))).toEqual(c.specification);
      expect(c.prepare).toBeTypeOf('function');
      expect('query' in c.observer ? c.observer.query : c.observer.reason).toBeTruthy();
      if (c.outcome !== 'success') expect(c.error).toBeTruthy();
    }
  });
  it('covers every owned domain mutation, including nested canvas command, with success and anonymous rejection', () => {
    const cases = contentMutationCases();
    function paths(registry: Record<string, unknown>, prefix: string): string[] {
      return Object.entries(registry).flatMap(([name, value]) => {
        const path = `${prefix}.${name}`;
        return value && typeof value === 'object' && 'fn' in value
          ? [path]
          : value && typeof value === 'object'
            ? paths(value as Record<string, unknown>, path)
            : [];
      });
    }
    for (const [domain, registry] of Object.entries({
      statements: statementSharedMutators,
      todos: todoSharedMutators,
      documents: documentSharedMutators,
      blogs: blogSharedMutators,
      messages: messageSharedMutators,
      studio: studioSharedMutators,
      projectChat: projectChatSharedMutators,
    })) {
      for (const name of paths(registry, domain)) {
        expect(
          cases.some(c => c.name === name && c.actor === 'owner' && c.outcome === 'success'),
          name
        ).toBe(true);
        expect(
          cases.some(c => c.name === name && c.actor === 'anonymous' && c.outcome !== 'success'),
          name
        ).toBe(true);
      }
    }
  });
  it('covers document ownership and a revoked collaborator without inventing observers for unlinked creation', () => {
    const cases = contentMutationCases();
    for (const action of Object.keys(documentSharedMutators)) {
      expect(cases.some(c => c.name === `documents.${action}` && c.outcome === 'success')).toBe(
        true
      );
    }
    expect(
      cases.find(c => c.name === 'documents.create' && c.outcome === 'success')?.observer
    ).toHaveProperty('reason');
    expect(
      cases.find(c => c.name === 'documents.updateContent' && c.variant === 'revoked-denied')
        ?.outcome
    ).toBe('server-error');
  });
  it('retains a real accepted-recipient delivery branch with reviewed durable-outbox expectations', () => {
    const entry = contentMutationCases().find(
      c => c.name === 'messages.sendMessage' && c.variant === 'accepted-recipient-push-delivery'
    );
    expect(entry).toMatchObject({
      actor: 'owner',
      outcome: 'success',
      observer: { query: 'messages.conversationById' },
    });
    expect(entry?.specification).toMatchObject({
      expected: {
        notificationType: 'direct_message',
        notificationJobs: 1,
        notificationJobStatus: 'completed',
        deliveryJobs: 1,
        deliveryStatus: 'sent',
        attempts: 1,
      },
    });
    // Per-attempt subscription encryption material is never part of persistent oracle/report metadata.
    expect(JSON.stringify(entry?.specification)).not.toContain('p256dh');
    expect(JSON.stringify(entry?.specification)).not.toContain('privateKey');
  });
  it('retains authority revocation after writer preload separately from already-revoked denial', () => {
    const entries = contentMutationCases().filter(c => c.name === 'documents.updateContent');
    const entry = entries.find(c => c.variant === 'rights-revoked-after-writer-preload');
    expect(entry).toMatchObject({
      actor: 'outsider',
      outcome: 'server-error',
      error: 'permission_denied',
    });
    expect(entry?.specification).toMatchObject({
      initialAuthority: 'active document collaborator',
      transition:
        'SQL revokes collaborator only after writer preload, before real subject invocation',
      expected:
        'permission_denied; original content and revision 0 remain; revoked collaborator retains existing public-query read access',
      rollback:
        'settled writer query contains original content and revision 0, with no optimistic changed content',
    });
    expect(entries.some(c => c.variant === 'revoked-denied')).toBe(true);
  });
});
