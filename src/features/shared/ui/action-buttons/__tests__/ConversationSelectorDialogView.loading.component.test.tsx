/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConversationSelectorDialogView } from '../ConversationSelectorDialogView';

afterEach(() => {
  cleanup();
});

describe('ConversationSelectorDialogView loading state', () => {
  it('renders compact skeleton rows while conversations load', () => {
    render(
      <ConversationSelectorDialogView
        open
        onOpenChange={vi.fn()}
        conversations={[]}
        isLoading
        onShareToConversation={vi.fn()}
        shareUrl="/amendment/1"
        shareTitle="Amendment"
        shareDescription=""
        shareContextItem={null}
        title="Share"
        searchPlaceholder="Search conversations"
        emptyLabel="No conversations"
        loadingLabel="Loading conversations"
        t={(key: string) => key}
        searchQuery=""
        setSearchQuery={vi.fn()}
        sending={null}
        setSending={vi.fn()}
        filteredConversations={[]}
        handleShareToConversation={vi.fn()}
      />
    );

    expect(screen.getByText('Loading conversations')).toBeTruthy();
    expect(document.querySelector('[data-slot="section-skeleton"]')).toBeTruthy();
  });
});
