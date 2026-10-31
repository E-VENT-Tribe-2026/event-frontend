import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProfileLoadingRunner from '@/components/ProfileLoadingRunner';

describe('ProfileLoadingRunner', () => {
  it('shows a running person while the profile loads', () => {
    render(<ProfileLoadingRunner />);
    const status = screen.getByTestId('profile-loading-runner');
    expect(status).toHaveAttribute('aria-label', 'Loading profile');
    expect(screen.getByText('Loading profile…')).toBeInTheDocument();
  });

  it('covers the screen while an action is in flight', () => {
    render(<ProfileLoadingRunner overlay label="Loading…" />);
    const status = screen.getByTestId('profile-loading-runner');
    expect(status).toHaveAttribute('aria-label', 'Loading');
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(status.className).toMatch(/fixed/);
  });
});
