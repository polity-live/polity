/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const controller = vi.hoisted(() => ({
  useLoginFormController: vi.fn(() => ({ email: 'ada@example.test', marker: 'controller-props' })),
}));

vi.mock('@/features/auth/hooks/useLoginFormController', () => controller);
vi.mock('../LoginFormView', () => ({
  LoginFormView: (props: { email: string; marker: string }) => (
    <output>{`${props.marker}:${props.email}`}</output>
  ),
}));

import { LoginForm } from '../LoginForm';

afterEach(cleanup);

describe('login form adapter', () => {
  it('passes the complete controller model to the login view', () => {
    render(<LoginForm />);

    expect(controller.useLoginFormController).toHaveBeenCalledTimes(1);
    expect(screen.getByText('controller-props:ada@example.test')).toBeTruthy();
  });
});
