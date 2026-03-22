import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AuthForm } from './auth-form';
import { ToastProvider } from './toast';

describe('AuthForm', () => {
  it('shows a toast after login submit in demo mode', () => {
    render(
      <ToastProvider>
        <AuthForm mode="login" />
      </ToastProvider>,
    );

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'demo@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/пароль/i), {
      target: { value: 'StrongPass123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /войти/i }));

    expect(screen.getByText(/демо-вход выполнен/i)).toBeInTheDocument();
    expect(screen.getByText(/форма пока работает как ui-скелет/i)).toBeInTheDocument();
  });
});
