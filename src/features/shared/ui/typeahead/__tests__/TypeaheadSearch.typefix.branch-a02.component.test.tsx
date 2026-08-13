/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useState: <T,>(initial: T | (() => T)) => {
      if (initial === null) {
        return [null, vi.fn()] as const;
      }
      return actual.useState(initial);
    },
  };
});

const mocks = vi.hoisted(() => ({
  opened: false,
  viewProps: undefined as Record<string, unknown> | undefined,
}));

vi.mock('../TypeaheadSearchBaseView', async () => {
  const React = await import('react');
  return {
    TypeaheadSearchBaseView: (props: Record<string, unknown>) => {
      mocks.viewProps = props;
      React.useLayoutEffect(() => {
        if (!mocks.opened) {
          mocks.opened = true;
          (props.setIsOpen as (open: boolean) => void)(true);
        }
      }, [props.setIsOpen]);
      return (
        <div ref={props.containerRef as never}>
          <div ref={props.inputWrapperRef as never}>Input</div>
        </div>
      );
    },
  };
});

import { TypeaheadSearchBaseContainer } from '../TypeaheadSearch';

afterEach(() => {
  cleanup();
  mocks.opened = false;
  mocks.viewProps = undefined;
});

describe('typeahead post-typefix portal readiness', () => {
  it('leaves dropdown positioning untouched while no portal target is available', () => {
    render(
      <TypeaheadSearchBaseContainer
        query=""
        sourceItems={[]}
        searchResults={[]}
        setQuery={vi.fn()}
        value={undefined}
        onChange={vi.fn()}
      />
    );

    expect(mocks.viewProps?.isOpen).toBe(true);
    expect(mocks.viewProps?.portalTarget).toBeNull();
  });
});
