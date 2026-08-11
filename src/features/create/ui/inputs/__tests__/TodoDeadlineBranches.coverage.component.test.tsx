/* @vitest-environment jsdom */

import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const captured = vi.hoisted(() => ({ props: undefined as Record<string, any> | undefined }));
vi.mock('../DateTimeRangeInput', () => ({
  DateTimeRangeInput: (props: Record<string, any>) => {
    captured.props = props;
    return <div />;
  },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { TodoDeadlineInput } from '../TodoDeadlineInput';

describe('TodoDeadlineInput remaining change branches', () => {
  it('keeps time for a new date, changes time, and ignores unrelated fields', () => {
    const onChange = vi.fn();
    render(<TodoDeadlineInput dueDate="2026-08-10" dueTime="14:30" onChange={onChange} />);
    captured.props?.onChange('startDate', '2026-08-11');
    captured.props?.onChange('startTime', '15:00');
    captured.props?.onChange('endDate', '2026-08-12');
    expect(onChange.mock.calls).toEqual([
      [{ dueDate: '2026-08-11', dueTime: '14:30' }],
      [{ dueDate: '2026-08-10', dueTime: '15:00' }],
    ]);
  });
});
