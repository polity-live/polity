/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { FormSection } from '../FormSection';

afterEach(() => cleanup());

describe('FormSection', () => {
  it('renders a complete header and custom classes', () => {
    const { container } = render(
      <FormSection
        title="Profile"
        description="Public information"
        action={<button>Edit</button>}
        className="section-custom"
        headerClassName="header-custom"
        contentClassName="content-custom"
      >
        <span>Form body</span>
      </FormSection>
    );

    expect(screen.getByText('Profile')).toBeTruthy();
    expect(screen.getByText('Public information')).toBeTruthy();
    expect(screen.getByText('Edit')).toBeTruthy();
    expect(container.querySelector('section')?.className).toContain('section-custom');
    expect(screen.getByText('Form body').parentElement?.className).toContain('content-custom');
  });

  it('renders a header for description alone', () => {
    render(
      <FormSection description="Only description">
        <span>Body</span>
      </FormSection>
    );
    expect(screen.getByText('Only description')).toBeTruthy();
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('renders a header for action alone', () => {
    render(
      <FormSection action={<button>Only action</button>}>
        <span>Body</span>
      </FormSection>
    );
    expect(screen.getByText('Only action')).toBeTruthy();
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('omits the header when no header content is provided', () => {
    const { container } = render(
      <FormSection>
        <span>Body only</span>
      </FormSection>
    );
    expect(container.querySelector('section')?.children).toHaveLength(1);
    expect(screen.getByText('Body only')).toBeTruthy();
  });
});
