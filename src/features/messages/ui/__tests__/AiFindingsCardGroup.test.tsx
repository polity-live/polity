/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AiFindingsCardGroup } from '../AiFindingsCardGroup';

afterEach(cleanup);

describe('AiFindingsCardGroup', () => {
  it('shows four findings initially and expands the remaining results', () => {
    render(
      <AiFindingsCardGroup
        presentation={{
          type: 'findings',
          id: 'findings',
          title: 'Findings',
          items: Array.from({ length: 6 }, (_, index) => ({
            id: String(index),
            title: `Finding ${index + 1}`,
            description: `Description ${index + 1}`,
            tone: index === 0 ? 'danger' : 'neutral',
          })),
        }}
      />
    );

    expect(screen.getByText('Finding 4')).toBeTruthy();
    expect(screen.queryByText('Finding 5')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /2|more|weitere/i }));
    expect(screen.getByText('Finding 5')).toBeTruthy();
    expect(screen.getByText('Finding 6')).toBeTruthy();
  });
});
