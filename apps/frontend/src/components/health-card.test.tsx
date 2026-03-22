import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HealthCard } from './health-card';

describe('HealthCard', () => {
  it('renders the shared hero content', () => {
    render(<HealthCard />);

    expect(screen.getByRole('heading', { name: /flower survey workspace/i })).toBeInTheDocument();
    expect(screen.getByText(/nestjs backend on port 4000/i)).toBeInTheDocument();
  });
});
