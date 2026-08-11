/* @vitest-environment jsdom */

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, values?: { groupName?: string }) => values?.groupName ?? key,
}));
vi.mock('@/features/shared/theme', async importOriginal => {
  const actual = await importOriginal<typeof import('@/features/shared/theme')>();
  return { ...actual, featureThemeClassName: (key: string) => key };
});
vi.mock('@/features/shared/ui/ui/dialog', () => ({
  Dialog: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogTrigger: ({ children }: any) => <>{children}</>,
}));
vi.mock('@/features/shared/ui/dialog', () => ({
  ScrollableDialogContent: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui/avatar', () => ({
  Avatar: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  AvatarFallback: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  AvatarImage: (props: any) => <img {...props} />,
}));
vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children }: any) => <span>{children}</span>,
}));
vi.mock('@/features/shared/ui/ui/card', () => ({
  Card: ({ asChild, children }: any) =>
    asChild ? React.Children.only(children) : <article>{children}</article>,
  CardDescription: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <header>{children}</header>,
  CardTitle: ({ children }: any) => <h2>{children}</h2>,
}));
vi.mock('@/features/shared/ui/navigation/SmartLink.tsx', () => ({
  SmartLink: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { CreateDocumentDialogView } from '../CreateDocumentDialogView';
import { DocumentHeader } from '../DocumentHeader';
import { GroupDocumentCard } from '../GroupDocumentCard';
import { PresenceIndicators } from '../PresenceIndicators';

afterEach(cleanup);

describe('document view remaining branches', () => {
  it('renders dialog without a group and in creating state', () => {
    const onTitleChange = vi.fn();
    render(
      <CreateDocumentDialogView
        isCreating
        isOpen
        onCreate={vi.fn()}
        onKeyDown={vi.fn()}
        onOpenChange={vi.fn()}
        onTitleChange={onTitleChange}
        title="Title"
      />
    );
    const input = screen.getByDisplayValue('Title');
    fireEvent.change(input, { target: { value: 'Changed' } });
    expect(onTitleChange).toHaveBeenCalledWith('Changed');
    expect(
      (document.querySelector('[data-action-id="documents.create.submit"]') as HTMLButtonElement)
        .disabled
    ).toBe(true);
    expect(screen.getByText('generated.inline.0409_creating_28ea7667')).toBeTruthy();
  });

  it('renders both header save states and owner visibility', () => {
    const onTitleChange = vi.fn();
    const { rerender } = render(
      <DocumentHeader title="Doc" onTitleChange={onTitleChange} isSaving isOwner onlinePeers={[]} />
    );
    expect(screen.getByText('generated.inline.0268_saving_ae7e8875')).toBeTruthy();
    expect(screen.getByText('generated.inline.0412_owner_89ff3122')).toBeTruthy();
    fireEvent.change(screen.getByDisplayValue('Doc'), { target: { value: 'Changed' } });
    expect(onTitleChange).toHaveBeenCalledWith('Changed');

    rerender(
      <DocumentHeader
        title="Doc"
        onTitleChange={onTitleChange}
        isSaving={false}
        isOwner={false}
        onlinePeers={[]}
      />
    );
    expect(screen.getByText('generated.inline.0411_auto_save_enabled_914b94c9')).toBeTruthy();
    expect(screen.queryByText('generated.inline.0412_owner_89ff3122')).toBeNull();
  });

  it('renders card timestamp, collaborator, plural, updated fallback, and no-link variants', () => {
    const base = { id: 'doc', title: 'Doc', created_at: Date.UTC(2026, 0, 1), updated_at: 0 };
    const { rerender } = render(<GroupDocumentCard document={base} />);
    expect(document.querySelector('[data-action-id="documents.card.open"]')).toBeNull();

    rerender(
      <GroupDocumentCard
        document={{ ...base, updated_at: '2026-02-02' as never, collaborators: [{ id: 'one' }] }}
        href="/doc"
      />
    );
    expect(screen.getByRole('link').getAttribute('href')).toBe('/doc');
    expect(document.body.textContent).not.toContain('collaborators');

    rerender(
      <GroupDocumentCard document={{ ...base, collaborators: [{ id: 'one' }, { id: 'two' }] }} />
    );
    expect(document.body.textContent).toContain('s');
  });

  it('renders empty, singular, plural, image, and unnamed presence states', () => {
    const { rerender } = render(<PresenceIndicators peers={[]} />);
    expect(document.body.textContent).toBe('');
    rerender(
      <PresenceIndicators
        peers={[{ peerId: 'one', userId: 'one', name: 'Ada', color: '#fff', avatar: 'ada.png' }]}
      />
    );
    expect(screen.getByRole('img', { name: 'Ada' })).toBeTruthy();
    rerender(
      <PresenceIndicators
        peers={
          [
            { peerId: 'one', userId: 'one', name: 'Ada', color: '#fff' },
            { peerId: 'two', userId: 'two', name: undefined, color: '#000' },
          ] as never
        }
      />
    );
    expect(document.body.textContent).toContain('2');
  });
});
