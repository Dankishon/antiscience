import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountOverview } from './account-overview';
import { ToastProvider } from './toast';

describe('AccountOverview', () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const originalFetch = global.fetch;
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:gdpr-export');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    clickSpy.mockClear();
  });

  it('loads the active session and downloads the JSON export', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            user: {
              id: 'user-1',
              email: 'gdpr@example.com',
              displayName: 'GDPR User',
              roles: ['RESPONDENT'],
              createdAt: '2026-03-22T10:00:00.000Z',
              lastLoginAt: '2026-03-22T11:00:00.000Z',
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': 'attachment; filename="flower-survey-export.json"',
          },
        }),
      );

    render(
      <ToastProvider>
        <AccountOverview />
      </ToastProvider>,
    );

    await screen.findByText('gdpr@example.com');
    fireEvent.click(screen.getByRole('button', { name: /скачать мои данные/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/me/export', expect.any(Object));
    });

    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(screen.getByText(/json-файл с вашим профилем/i)).toBeInTheDocument();
  });

  it('requires typing DELETE before the destructive action becomes available', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            user: {
              id: 'user-2',
              email: 'delete@example.com',
              displayName: 'Delete User',
              roles: ['RESPONDENT'],
              createdAt: '2026-03-22T10:00:00.000Z',
              lastLoginAt: null,
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            deletedAt: '2026-03-22T12:00:00.000Z',
            deletionAuditId: 'audit-1',
            deletedResponseSessionsCount: 2,
            deletedRefreshTokensCount: 1,
            anonymizedAuditEntriesCount: 1,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

    render(
      <ToastProvider>
        <AccountOverview />
      </ToastProvider>,
    );

    await screen.findByText('delete@example.com');
    fireEvent.click(screen.getByRole('button', { name: /удалить мои данные/i }));

    const confirmButton = screen.getByRole('button', { name: /удалить навсегда/i });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/введите delete/i), {
      target: { value: 'DELETE' },
    });
    expect(confirmButton).not.toBeDisabled();

    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/me/delete', expect.any(Object));
    });

    expect(screen.getByText(/удалены привязанные сессии: 2/i)).toBeInTheDocument();
  });
});
