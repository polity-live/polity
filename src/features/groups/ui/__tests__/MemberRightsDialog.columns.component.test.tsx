/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

let tableProps: any;
vi.mock('@/features/shared/ui/data-table', () => ({
  DataTable: (props: any) => {
    tableProps = props;
    return <div />;
  },
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));

import { MemberRightsDialog } from '../MemberRightsDialog';

afterEach(cleanup);

describe('MemberRightsDialog rights columns', () => {
  it('renders direct and implied grant sources', () => {
    render(
      <MemberRightsDialog
        isOpen
        onOpenChange={vi.fn()}
        membership={null}
        onNavigateToUser={vi.fn()}
      />
    );
    const right = {
      key: 'right',
      label: 'Right',
      resource: 'groups',
      action: 'view',
      sources: [
        { roleId: 'direct', roleName: 'Direct', isDirect: true, viaLabel: null },
        { roleId: 'implied', roleName: 'Implied', isDirect: false, viaLabel: 'Parent' },
      ],
    };
    const { container } = render(
      <>
        {tableProps.columns[0].cell({ row: { original: right } })}
        {tableProps.columns[1].cell({ row: { original: right } })}
      </>
    );
    expect(container.textContent).toContain('components.memberRightsDialog.via');
    expect(container.textContent).toContain('direct');
    expect(container.textContent).toContain('implied');
  });
});
