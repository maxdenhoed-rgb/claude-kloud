import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import HomePage from '@/app/page';

describe('HomePage', () => {
  it('renders the hero heading and signup form', () => {
    render(<HomePage />);
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /practice for the claude certified architect exam/i,
      }),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: /notify me/i })).toBeDefined();
  });
});
