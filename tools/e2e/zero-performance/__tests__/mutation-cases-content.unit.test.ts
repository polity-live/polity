import { describe, expect, it } from 'vitest';
import { contentMutationCases } from '../mutation-cases-content';
import { statementSharedMutators } from '../../../../src/zero/statements/shared-mutators';
import { todoSharedMutators } from '../../../../src/zero/todos/shared-mutators';
import { documentSharedMutators } from '../../../../src/zero/documents/shared-mutators';
import { blogSharedMutators } from '../../../../src/zero/blogs/shared-mutators';
import { messageSharedMutators } from '../../../../src/zero/messages/shared-mutators';
import { studioSharedMutators } from '../../../../src/zero/communication-studio/shared-mutators';
import { projectChatSharedMutators } from '../../../../src/zero/project-chat/shared-mutators';
import { canvasCommandSchema } from '../../../../src/zero/communication-studio/commands';
import { canvasActions } from '../mutation-cases-canvas';
import {
  createMessageSchema,
  createConversationFullSchema,
  createConversationParticipantSchema,
} from '../../../../src/zero/messages/schema';
import { createThreadSchema } from '../../../../src/zero/discussions/schema';
import {
  createStudioDocumentV5,
  createFrameNode,
  studioNodeSchema,
} from '../../../../src/features/communication-studio/logic/document-v3';
import { mergeStudioV3 } from '../../../../src/features/communication-studio/logic/operations';

describe('reviewed content mutation specifications', () => {
  it('expects the canonical Studio node order after a successful title patch', () => {
    const frame = createFrameNode('square', {
      id: '12345678-1234-4234-8234-123456789abc',
      name: 'Fixture frame',
    });
    const rectangle = studioNodeSchema.parse({
      id: 'abcdefab-1234-4234-8234-123456789abc',
      type: 'shape',
      name: 'Fixture rectangle',
      shape: 'rectangle',
      parentFrameId: frame.id,
      transform: { x: 0, y: 0, width: 100, height: 100 },
      zIndex: 1,
      style: {},
    });
    const original = { ...createStudioDocumentV5('Fixture studio'), nodes: [frame, rectangle] };
    const result = mergeStudioV3(original, [
      {
        path: ['title'],
        before: { exists: true, value: 'Fixture studio' },
        after: { exists: true, value: 'Changed studio' },
      },
    ]);
    expect(result).toEqual({
      value: { ...original, title: 'Changed studio', nodes: [rectangle, frame] },
      conflicts: [],
    });
    expect(original.nodes).toEqual([frame, rectangle]);
    expect(
      contentMutationCases().find(c => c.name === 'studio.apply' && c.variant === 'authorized')
        ?.specification
    ).toMatchObject({
      applyNormalization:
        'successful title patch sorts rectangle (UUID parentFrameId) before frame (null parentFrameId); canonical revision 1 and durable applied receipt',
    });
  });
  it('uses the actual parsed unset timestamps for newly created messages, participants and document threads', () => {
    const message = createMessageSchema.parse({
      id: 'message',
      conversation_id: 'conversation',
      content: 'Fixture message',
      context_json: '[]',
      deleted_at: null,
    });
    expect(message).toMatchObject({ context_json: '[]', deleted_at: 0 });
    const participant = createConversationParticipantSchema.parse({
      id: 'participant',
      conversation_id: 'conversation',
      user_id: 'owner',
      joined_at: 1,
      last_read_at: 1,
      left_at: null,
    });
    expect(participant.left_at).toBe(0);
    const full = createConversationFullSchema.parse({
      conversation: {
        id: 'conversation',
        type: 'direct',
        name: 'Fixture conversation',
        status: 'accepted',
        pinned: false,
        last_message_at: null,
        group_id: null,
        event_id: null,
        assistant_for_user_id: null,
      },
      participants: [{ ...participant, left_at: null }],
    });
    expect(full.participants[0].left_at).toBe(0);
    const thread = createThreadSchema.parse({
      id: 'thread',
      document_id: 'document',
      amendment_id: null,
      statement_id: null,
      blog_id: null,
      todo_id: null,
      user_id: 'owner',
      content: 'Fixture thread',
      status: 'open',
      resolved_at: null,
      upvotes: 0,
      downvotes: 0,
      position: null,
    });
    expect(thread.resolved_at).toBe(0);
    const cases = contentMutationCases();
    for (const name of [
      'messages.sendMessage',
      'messages.sendAssistantMessage',
      'messages.createConversationFull',
      'messages.addParticipant',
    ]) {
      expect(
        cases.find(c => c.name === name && c.variant === 'authorized')?.specification
      ).toMatchObject({
        normalization: {
          contextJSON: '[]',
          nullableTimestampInput: null,
          nullableTimestampParsed: 0,
          sqlTimestamp: '1970-01-01T00:00:00.000Z',
        },
      });
    }
    expect(
      cases.find(c => c.name === 'documents.createThread' && c.variant === 'authorized')
        ?.specification
    ).toMatchObject({
      threadTimestamp: {
        createResolvedAtInput: null,
        parsed: 0,
        sql: '1970-01-01T00:00:00.000Z',
        existingFixtureResolvedAt: null,
      },
    });
  });
  it('covers every actual canvas discriminator with success, authentication, access and generation branches', () => {
    const registered = canvasCommandSchema.options.map(option => option.shape.action.value).sort();
    expect([...canvasActions].sort()).toEqual(registered);
    const cases = contentMutationCases().filter(c => c.name === 'studio.canvas.command');
    for (const action of registered) {
      const entries = cases.filter(c => (c.specification as { action?: string }).action === action);
      expect(entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            actor: 'owner',
            outcome: 'success',
            variant: `canvas-${action}-authorized`,
          }),
          expect.objectContaining({
            actor: 'outsider',
            outcome: 'server-error',
            error: 'permission_denied',
          }),
          expect.objectContaining({
            actor: 'anonymous',
            outcome: 'client-error',
            error: 'permission_denied',
          }),
          expect.objectContaining({
            actor: 'owner',
            outcome: 'server-error',
            error: 'project_revision_conflict',
            variant: `canvas-${action}-generation-conflict`,
          }),
          expect.objectContaining({
            actor: 'outsider',
            outcome: 'server-error',
            error: 'permission_denied',
            variant: `canvas-${action}-revoked-collaborator`,
          }),
        ])
      );
    }
    expect(cases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          variant: 'canvas-comment-capability-denied',
          actor: 'outsider',
          outcome: 'server-error',
          error: 'permission_denied',
        }),
        expect.objectContaining({ variant: 'canvas-saveDraft-merge-conflict', outcome: 'success' }),
        expect.objectContaining({
          variant: 'canvas-vote-collaborator',
          actor: 'outsider',
          outcome: 'success',
        }),
      ])
    );
  });
  it('distinguishes compatible historical apply from durable merge conflict and actual revoked authority', () => {
    const entries = contentMutationCases().filter(c => c.name === 'studio.apply');
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ variant: 'stale-revision-compatible', outcome: 'success' }),
        expect.objectContaining({ variant: 'stale-revision-merge-conflict', outcome: 'success' }),
        expect.objectContaining({ variant: 'future-revision', outcome: 'server-error' }),
        expect.objectContaining({ variant: 'stale-generation', outcome: 'server-error' }),
        expect.objectContaining({
          variant: 'revoked-collaborator',
          actor: 'outsider',
          outcome: 'server-error',
        }),
        expect.objectContaining({
          variant: 'rights-revoked-after-writer-preload',
          actor: 'outsider',
          outcome: 'server-error',
        }),
      ])
    );
    for (const entry of entries.filter(c => c.variant.includes('revoked'))) {
      expect(entry.specification).toMatchObject({
        permission:
          'actual personal collaborator revoked; studio read access is redacted; writer settles to null',
      });
    }
  });
  it('includes independently owned support votes by an authenticated third party on public content', () => {
    const entries = contentMutationCases().filter(
      c => c.variant === 'public-third-party-authorized'
    );
    expect(entries.map(c => c.name).sort()).toEqual(
      ['blogs', 'statements']
        .flatMap(domain =>
          ['createSupportVote', 'updateSupportVote', 'deleteSupportVote'].map(
            action => `${domain}.${action}`
          )
        )
        .sort()
    );
    for (const entry of entries)
      expect(entry).toMatchObject({ actor: 'outsider', outcome: 'success' });
  });
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
