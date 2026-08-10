/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '../pagination';

afterEach(cleanup);

describe('pagination primitives', () => {
  it('renders inactive and active links plus navigation helpers', () => {
    render(
      <Pagination className="custom">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious href="/previous" />
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="/one">1</PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="/two" isActive size="default">
              2
            </PaginationLink>
          </PaginationItem>
          <PaginationEllipsis />
          <PaginationItem>
            <PaginationNext href="/next" />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
    expect(screen.getByRole('navigation').className).toContain('custom');
    expect(screen.getByRole('link', { name: '2' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: '1' }).getAttribute('aria-current')).toBeNull();
    expect(screen.getByText(/more pages/i)).toBeTruthy();
  });
});
