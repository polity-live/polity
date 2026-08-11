// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AiContextCards } from '../AiContextCards';

const mocks = vi.hoisted(() => ({
  parsedAttachments: [] as any[],
  presentations: [] as any[],
  findingProps: [] as any[],
}));

vi.mock('@/features/messages/logic/contextAttachments', () => ({
  parseContextAttachments: () => mocks.parsedAttachments,
  parseContextPresentations: () => mocks.presentations,
}));
vi.mock('@/features/messages/logic/uploadAttachmentCard', () => ({
  isUploadAttachmentCardPayload: (value: any) => value?.kind === 'upload',
  formatUploadFileSize: (size: number) => `${size} B`,
  buildUploadAttachmentDownloadUrl: (url: string, name: string) => `${url}?download=${name}`,
}));
vi.mock('@/features/messages/ui/AiFindingsCardGroup', () => ({
  AiFindingsCardGroup: (props: any) => {
    mocks.findingProps.push(props);
    return <div>finding</div>;
  },
}));
vi.mock('@/features/shared/theme', () => ({
  getEntityToneClasses: () => ({ border: 'entity-border', badge: 'entity-badge' }),
  getSemanticToneClasses: () => ({ border: 'neutral-border', badge: 'neutral-badge' }),
}));
vi.mock('@/features/shared/logic/entityCardHelpers', () => ({
  getEntityIcon: () => (props: any) => <i {...props} />,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/ui/navigation/SmartLink', () => ({
  SmartLink: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children }: any) => <span>{children}</span>,
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock('@/features/shared/ui/ui/card', () => ({
  Card: ({ children }: any) => <section>{children}</section>,
  CardContent: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/shared/utils/utils', () => ({
  cn: (...v: unknown[]) => v.filter(Boolean).join(' '),
}));

function attachment(id: string, overrides: Record<string, unknown> = {}) {
  return { entityType: 'group', entityId: id, title: `Title ${id}`, ...overrides } as any;
}

afterEach(() => {
  cleanup();
  mocks.parsedAttachments = [];
  mocks.presentations = [];
  mocks.findingProps = [];
});

describe('AiContextCards exhaustive branches', () => {
  it('returns null for empty parsed context and renders presentations without cards', () => {
    const rendered = render(<AiContextCards contextJson="empty" />);
    expect(rendered.container.childElementCount).toBe(0);
    mocks.presentations = [{ id: 'presentation' }];
    rendered.rerender(<AiContextCards contextJson="presentation" />);
    expect(mocks.findingProps).toHaveLength(1);
  });

  it('renders upload, linked, plain, skill and expandable input cards', () => {
    const upload = JSON.stringify({
      kind: 'upload',
      previewType: 'image',
      fileSize: 2,
      fileUrl: '/file',
      fileName: 'file.png',
      fileType: 'image/png',
    });
    const attachments = [
      attachment('upload', { card_data_json: upload, subtitle: null }),
      attachment('linked', {
        entityType: 'todo',
        href: '/todo',
        subtitle: 'Subtitle',
        prompt_context: ' Preview  text ',
      }),
      attachment('plain', { entityType: 'document', prompt_context: '   ' }),
      attachment('skill', {
        entityType: 'skill',
        subtitle: 'command',
        prompt_context: 'Skill preview',
      }),
      attachment('skill-empty', { entityType: 'skill', subtitle: null, prompt_context: null }),
      attachment('invalid', { card_data_json: '{"kind":"other"}' }),
      attachment('malformed', { card_data_json: '{' }),
    ];
    render(<AiContextCards attachments={attachments} />);
    expect(screen.getByText('Subtitle')).toBeTruthy();
    expect(screen.getByText('/command')).toBeTruthy();
    expect(screen.getByText('Skill preview')).toBeTruthy();
    expect(
      document.querySelector('[data-action-id="messages.ai-context.attachment.open"]')
    ).toBeTruthy();
    const toggle = document.querySelector('[data-action-id="messages.ai-context.expand.toggle"]')!;
    fireEvent.click(toggle);
    fireEvent.click(toggle);
  });

  it('splits output and update cards and resolves fallback card data', () => {
    const resolve = vi.fn(() =>
      JSON.stringify({
        kind: 'upload',
        previewType: 'file',
        fileSize: 3,
        fileUrl: '/doc',
        fileName: 'doc.pdf',
        fileType: '',
      })
    );
    render(
      <AiContextCards
        contextLabel="output"
        resolveAttachmentCardData={resolve}
        attachments={[
          attachment('todo', { entityType: 'todo', context_type: 'output' }),
          attachment('update', { context_type: 'update' }),
          attachment('resolved', { card_data_json: null }),
        ]}
      />
    );
    expect(resolve).toHaveBeenCalled();
    expect(document.body.textContent).toContain('features.messages.ai.outputContextCardLabel');
    expect(document.body.textContent).toContain('features.messages.ai.updateContextCardLabel');
  });
});
